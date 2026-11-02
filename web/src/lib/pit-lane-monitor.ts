import type { Payload } from 'payload'
import sharp from 'sharp'
import { isIP } from 'node:net'
import { nextHealth, safeHttpURL, type Health, type ProbeResult } from './pit-lane'

/**
 * Pit Lane monitor: every 15 minutes probe approved friends' homepages (health / red flag),
 * every 6 hours look for the reciprocal merakt.cn link, and fetch the site logo when the
 * logo source is automatic. Friends' posts and update times are never tracked. Enabled with PIT_LANE_MONITOR=1.
 */
const USER_AGENT = 'MerakPitLane/1.0 (+https://merakt.cn)'
const TIMEOUT = 8000
const HEALTH_EVERY = 15 * 60000
const BACKLINK_EVERY = 6 * 3600000
const LOGO_EVERY = 30 * 86400000
const MAX_TEXT = 512 * 1024
const MAX_IMAGE = 2 * 1024 * 1024

type Fetched = { response: Response; url: string; latencyMs: number }
type FriendDoc = { id: number; tla: string; name: string; url: string; backlinkUrl?: string | null; logoSource?: string | null; logo?: number | { id: number; filename?: string | null } | null; health?: Health | null; backlinkCheckedAt?: string | null; logoCheckedAt?: string | null }

/** Friends are admin-approved, but still refuse loopback/private targets. */
export function publicTarget(value: string): URL | null {
  const href = safeHttpURL(value)
  if (!href) return null
  const url = new URL(href)
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null
  if (isIP(host) === 4 && /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return null
  if (isIP(host) === 6 && /^(::1?$|f[cd]|fe80|::ffff:)/.test(host)) return null
  return url
}

async function fetchFollow(target: string, accept: string): Promise<Fetched> {
  const started = performance.now()
  let current = target
  for (let hop = 0; hop <= 3; hop++) {
    const url = publicTarget(current)
    if (!url) throw new Error('blocked target')
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': USER_AGENT, Accept: accept } })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) { await response.body?.cancel(); current = new URL(location, url).href; continue }
    return { response, url: url.href, latencyMs: Math.round(performance.now() - started) }
  }
  throw new Error('too many redirects')
}

async function readLimited(response: Response, limit: number): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new Error('response too large') }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function probe(url: string): Promise<ProbeResult & { html?: string; finalURL?: string }> {
  try {
    const { response, latencyMs, url: finalURL } = await fetchFollow(url, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5')
    const ok = response.status >= 200 && response.status < 400
    const html = ok && /html/i.test(response.headers.get('content-type') || '') ? (await readLimited(response, MAX_TEXT).catch(() => Buffer.alloc(0))).toString('utf8') : (await response.body?.cancel(), undefined)
    return { ok, status: response.status, latencyMs, retryAfter: response.headers.has('retry-after'), html, finalURL }
  } catch { return { ok: false } }
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(Boolean)
const linkTags = (html: string) => (html.match(/<link\b[^>]*>/gi) || [])
const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&quot;/g, '"')

/** Icon candidates in spec order: apple-touch-icon → largest rel=icon → manifest icons → /favicon.ico. */
export function discoverIcons(html: string, base: string): { icons: string[]; manifest?: string } {
  const tags = linkTags(html)
  const size = (tag: string) => Math.max(0, ...(attr(tag, 'sizes') || '').split(/\s+/).map(part => /any/i.test(part) ? 1024 : Number(part.split('x')[0]) || 0))
  const href = (tag: string) => { const value = attr(tag, 'href'); return value ? new URL(decode(value), base).href : null }
  const apple = tags.filter(tag => /apple-touch-icon/i.test(attr(tag, 'rel') || '')).sort((a, b) => size(b) - size(a)).map(href)
  const icons = tags.filter(tag => /(^|\s)icon(\s|$)/i.test(attr(tag, 'rel') || '')).sort((a, b) => size(b) - size(a)).map(href)
  const manifestTag = tags.find(tag => /\bmanifest\b/i.test(attr(tag, 'rel') || ''))
  return { icons: [...new Set([...apple, ...icons].filter(Boolean) as string[])], manifest: manifestTag ? href(manifestTag) || undefined : undefined }
}

/** Extract the largest PNG frame from a .ico container (BMP frames are skipped). */
export function pngFromIco(data: Buffer): Buffer | null {
  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) return null
  const count = data.readUInt16LE(4)
  let best: { size: number; frame: Buffer } | null = null
  for (let index = 0; index < count && 6 + index * 16 + 16 <= data.length; index++) {
    const entry = 6 + index * 16
    const width = data[entry] || 256, length = data.readUInt32LE(entry + 8), offset = data.readUInt32LE(entry + 12)
    const frame = data.subarray(offset, offset + length)
    if (frame.length === length && frame.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && (!best || width > best.size)) best = { size: width, frame }
  }
  return best?.frame || null
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const { response } = await fetchFollow(url, 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8')
    if (!response.ok) { await response.body?.cancel(); return null }
    let data = await readLimited(response, MAX_IMAGE)
    if (data.readUInt16LE(0) === 0 && data.readUInt16LE(2) === 1) data = pngFromIco(data) || Buffer.alloc(0)
    if (!data.length) return null
    const meta = await sharp(data, { density: 300 }).metadata()
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 32) return null
    return await sharp(data, { density: 300 }).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 }).toBuffer()
  } catch { return null }
}

async function discoverLogo(html: string, base: string): Promise<Buffer | null> {
  const { icons, manifest } = discoverIcons(html, base)
  const candidates = [...icons]
  if (manifest) {
    try {
      const { response } = await fetchFollow(manifest, 'application/manifest+json,application/json')
      const json = JSON.parse((await readLimited(response, 64 * 1024)).toString('utf8')) as { icons?: { src?: string; sizes?: string }[] }
      const sized = (json.icons || []).filter(icon => icon.src).sort((a, b) => (Number(b.sizes?.split('x')[0]) || 0) - (Number(a.sizes?.split('x')[0]) || 0))
      candidates.push(...sized.map(icon => new URL(icon.src!, manifest).href))
    } catch { /* manifest is optional */ }
  }
  candidates.push(new URL('/favicon.ico', base).href)
  for (const candidate of [...new Set(candidates)].slice(0, 8)) { const image = await fetchImage(candidate); if (image) return image }
  return null
}

const stale = (value: string | null | undefined, every: number, now: number) => !value || now - Date.parse(value) >= every
// A real anchor to merakt.cn, not just the word in a sentence.
const BACKLINK = /<a\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\/(?:www\.)?merakt\.cn(?=[\/"'\s>?#:]|$)/i
/** Does any of these pages (homepage or links page) link to merakt.cn? */
export async function verifyBacklink(urls: string[], homepageHTML?: string): Promise<boolean> {
  if (homepageHTML && BACKLINK.test(homepageHTML)) return true
  for (const url of urls) { const result = await probe(url); if (result.html && BACKLINK.test(result.html)) return true }
  return false
}

export async function checkFriend(payload: Payload, friend: FriendDoc, now = Date.now()) {
  const result = await probe(friend.url)
  const health = nextHealth(friend.health, result)
  const data: Record<string, unknown> = { health: { ...health, checkedAt: new Date(now).toISOString() } }
  const base = result.finalURL || friend.url
  if (result.ok && stale(friend.backlinkCheckedAt, BACKLINK_EVERY, now)) {
    data.backlinkCheckedAt = new Date(now).toISOString()
    // Reciprocal link: homepage first, then the links page the friend told us about.
    data.backlinkAt = await verifyBacklink(friend.backlinkUrl ? [friend.backlinkUrl] : [], result.html) ? new Date(now).toISOString() : null
  }
  const logoID = typeof friend.logo === 'object' ? friend.logo?.id : friend.logo
  if (result.ok && friend.logoSource === 'auto' && (!logoID || stale(friend.logoCheckedAt, LOGO_EVERY, now))) {
    data.logoCheckedAt = new Date(now).toISOString()
    const image = await discoverLogo(result.html || '', base)
    if (image) {
      const media = await payload.create({ collection: 'media', overrideAccess: true, data: { alt: `${friend.name} logo`, altEn: `${friend.name} logo`, source: friend.url, visibility: 'public' },
        file: { data: image, mimetype: 'image/webp', name: `pit-logo-${friend.tla.toLowerCase()}-${now}.webp`, size: image.length } })
      data.logo = media.id
      if (logoID) await payload.delete({ collection: 'media', id: logoID, overrideAccess: true }).catch(() => undefined)
    }
  }
  if (friend.health?.state !== health.state) payload.logger.info(`PIT LANE ${friend.tla}: ${friend.health?.state || 'green'} → ${health.state}`)
  await payload.update({ collection: 'friends', id: friend.id, data, overrideAccess: true, depth: 0 })
  return health
}

export async function runPitLaneMonitor(payload: Payload, now = Date.now()) {
  const { docs } = await payload.find({ collection: 'friends', where: { status: { equals: 'approved' } }, depth: 0, limit: 200, pagination: false, overrideAccess: true })
  const due = (docs as unknown as FriendDoc[]).filter(friend => stale(friend.health?.checkedAt as string | undefined, HEALTH_EVERY - 30000, now))
  for (let index = 0; index < due.length; index += 4) {
    await Promise.all(due.slice(index, index + 4).map(friend => checkFriend(payload, friend, now).catch(() => payload.logger.warn(`PIT LANE ${friend.tla}: 检查未完成，下一轮重试。`))))
  }
}

type MonitorState = { running: boolean; timer: NodeJS.Timeout }
const monitorHost = globalThis as typeof globalThis & { merakPitLaneMonitor?: MonitorState }

export function startPitLaneMonitor(payload: Payload) {
  if (process.env.PIT_LANE_MONITOR !== '1' || process.env.NEXT_PHASE === 'phase-production-build' || monitorHost.merakPitLaneMonitor) return
  const state: MonitorState = { running: false, timer: setInterval(tick, 60000) }
  monitorHost.merakPitLaneMonitor = state
  state.timer.unref()
  async function tick() {
    if (state.running) return
    state.running = true
    try { await runPitLaneMonitor(payload) } catch { payload.logger.error('PIT LANE 监控本轮未完成，将在下一轮重试。') }
    finally { state.running = false }
  }
  void tick()
}
