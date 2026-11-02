import type { Payload } from 'payload'
import sharp from 'sharp'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable, type Readable as NodeReadable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import { nextHealth, safeHttpURL, type Health, type ProbeResult } from './pit-lane'

/**
 * Pit Lane monitor: every 15 minutes probe approved friends' homepages (health / red flag),
 * and fetch the site logo when the logo source is automatic. Reciprocal links are reviewed by hand
 * (links pages are often script-rendered or block non-browser requests). Friends' posts and update times are never tracked. Enabled with PIT_LANE_MONITOR=1.
 */
// Crawler-style UA (like Googlebot's): still names us, but passes guards that only admit Mozilla-compatible agents.
const USER_AGENT = 'Mozilla/5.0 (compatible; MerakPitLane/1.0; +https://merakt.cn)'
const TIMEOUT = 8000
const HEALTH_EVERY = 15 * 60000
const LOGO_EVERY = 30 * 86400000, LOGO_RETRY = 3600000
const MAX_TEXT = 512 * 1024
const MAX_IMAGE = 2 * 1024 * 1024
/** Smallest icon worth keeping; a sharp 16 px favicon beats a monogram, bigger candidates still win. */
const MIN_ICON = 16, GOOD_ICON = 128

type Fetched = { response: Response; url: string; latencyMs: number }
/** Cookies from one friend check (homepage → icons). Some sites only serve assets to visitors who opened the homepage. */
export type CookieJar = Map<string, Map<string, string>>
function remember(jar: CookieJar | undefined, url: URL, response: Response) {
  if (!jar) return
  for (const line of response.headers.getSetCookie?.() || []) {
    const [pair] = line.split(';'), index = pair.indexOf('=')
    if (index < 1) continue
    const host = jar.get(url.hostname) || new Map<string, string>()
    host.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim()); jar.set(url.hostname, host)
  }
}
const cookieHeader = (jar: CookieJar | undefined, url: URL) => [...(jar?.get(url.hostname) || [])].map(([name, value]) => `${name}=${value}`).join('; ')
type FriendDoc = { id: number; tla: string; name: string; url: string; logoSource?: string | null; logo?: number | { id: number; filename?: string | null } | null; health?: Health | null; logoCheckedAt?: string | null }
export type LogoFriend = Pick<FriendDoc, 'id' | 'tla' | 'name' | 'url' | 'logo'>

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

/**
 * Plain HTTP GET as a web Response. Not global fetch: it always sends `Sec-Fetch-Mode: cors`,
 * which some friends' bot guards reject for page loads even though a browser visit would pass.
 */
function get(url: URL, headers: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = send(url, { method: 'GET', headers, timeout: TIMEOUT }, res => {
      const status = res.statusCode || 502, list = new Headers()
      for (const [name, value] of Object.entries(res.headers)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) list.append(name, String(item))
      const empty = [204, 205, 304].includes(status) || status < 200
      if (empty) res.resume()
      // We advertise gzip/deflate/br like a browser (some bot guards flag requests that don't), so unpack here.
      const encoding = String(res.headers['content-encoding'] || '').trim().toLowerCase()
      const unpack = encoding === 'gzip' || encoding === 'x-gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : null
      let body: NodeReadable = res
      if (unpack && !empty) { body = res.pipe(unpack); res.on('error', error => unpack.destroy(error)); list.delete('content-encoding'); list.delete('content-length') }
      resolve(new Response(empty ? null : Readable.toWeb(body) as ReadableStream, { status: Math.min(Math.max(status, 200), 599), headers: list }))
    })
    // Idle timeout per socket, plus a hard deadline so a trickling response cannot hold the monitor.
    const deadline = setTimeout(() => req.destroy(new Error('deadline')), TIMEOUT * 2)
    req.on('close', () => clearTimeout(deadline))
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

async function fetchFollow(target: string, accept: string, jar?: CookieJar, referer?: string): Promise<Fetched> {
  const started = performance.now()
  let current = target
  for (let hop = 0; hop <= 3; hop++) {
    const url = publicTarget(current)
    if (!url) throw new Error('blocked target')
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', 'Accept-Encoding': 'gzip, deflate, br' }
    const cookies = cookieHeader(jar, url); if (cookies) headers.Cookie = cookies
    if (referer) headers.Referer = referer
    const response = await get(url, headers)
    remember(jar, url, response)
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) { await response.body?.cancel(); current = new URL(location, url).href; continue }
    return { response, url: url.href, latencyMs: Math.round(performance.now() - started) }
  }
  throw new Error('too many redirects')
}

/** Read at most `limit` bytes; images over the limit are refused, pages are cut (icons live in <head>). */
async function readLimited(response: Response, limit: number, truncate = false): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); if (!truncate) throw new Error('response too large'); chunks.push(value.subarray(0, value.byteLength - (size - limit))); break }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** Bot walls (401/403/429) still prove the server is up, so they count as reachable; only 2xx/3xx bodies are read. */
const REACHABLE = new Set([401, 403, 429])
export async function probe(url: string, jar?: CookieJar): Promise<ProbeResult & { html?: string; finalURL?: string }> {
  try {
    const { response, latencyMs, url: finalURL } = await fetchFollow(url, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', jar)
    const served = response.status >= 200 && response.status < 400, ok = served || REACHABLE.has(response.status)
    const html = served && /html/i.test(response.headers.get('content-type') || '') ? (await readLimited(response, MAX_TEXT, true).catch(() => Buffer.alloc(0))).toString('utf8') : (await response.body?.cancel(), undefined)
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

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
type IcoFrame = { size: number; png?: Buffer; bmp?: Buffer }
function icoFrames(data: Buffer): IcoFrame[] {
  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) return []
  const frames: IcoFrame[] = []
  for (let index = 0, count = data.readUInt16LE(4); index < count && 6 + index * 16 + 16 <= data.length; index++) {
    const entry = 6 + index * 16
    const width = data[entry] || 256, length = data.readUInt32LE(entry + 8), offset = data.readUInt32LE(entry + 12)
    const frame = data.subarray(offset, offset + length)
    if (frame.length !== length || length < 8) continue
    frames.push(frame.subarray(0, 8).equals(PNG_MAGIC) ? { size: width, png: frame } : { size: width, bmp: frame })
  }
  return frames.sort((a, b) => b.size - a.size)
}

/** Extract the largest PNG frame from a .ico container (BMP frames are skipped). */
export function pngFromIco(data: Buffer): Buffer | null {
  return icoFrames(data).find(frame => frame.png)?.png || null
}

/**
 * Decode a classic BMP icon frame (BITMAPINFOHEADER, 1/4/8/24/32-bit, bottom-up, AND mask) to RGBA.
 * Most hand-made favicon.ico files are BMP inside, which sharp cannot read.
 */
export function rgbaFromIcoBmp(frame: Buffer): { width: number; height: number; data: Buffer } | null {
  if (frame.length < 40 || frame.readUInt32LE(0) < 40) return null
  const headerSize = frame.readUInt32LE(0), width = Math.abs(frame.readInt32LE(4)), height = Math.abs(frame.readInt32LE(8)) / 2
  const bpp = frame.readUInt16LE(14), compression = frame.readUInt32LE(16)
  if (!width || !height || width > 512 || height > 512 || compression !== 0 || ![1, 4, 8, 24, 32].includes(bpp)) return null
  const colours = bpp <= 8 ? frame.readUInt32LE(32) || 1 << bpp : 0
  const palette = headerSize, pixels = palette + colours * 4
  const stride = Math.ceil(width * bpp / 32) * 4, maskStride = Math.ceil(width / 32) * 4, mask = pixels + stride * height
  if (mask > frame.length) return null
  const out = Buffer.alloc(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const row = pixels + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      let b: number, g: number, r: number, a = 255
      if (bpp === 32) { b = frame[row + x * 4]; g = frame[row + x * 4 + 1]; r = frame[row + x * 4 + 2]; a = frame[row + x * 4 + 3]; if (a) anyAlpha = true }
      else if (bpp === 24) { b = frame[row + x * 3]; g = frame[row + x * 3 + 1]; r = frame[row + x * 3 + 2] }
      else {
        const bit = x * bpp, index = (frame[row + (bit >> 3)] >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1), entry = palette + index * 4
        b = frame[entry] ?? 0; g = frame[entry + 1] ?? 0; r = frame[entry + 2] ?? 0
      }
      out[at] = r; out[at + 1] = g; out[at + 2] = b; out[at + 3] = a
    }
  }
  // 32-bit frames carry real alpha; everything else (and all-zero alpha) uses the 1-bit AND mask.
  if (bpp !== 32 || !anyAlpha) for (let y = 0; y < height; y++) {
    const row = mask + (height - 1 - y) * maskStride
    for (let x = 0; x < width; x++) out[(y * width + x) * 4 + 3] = mask + maskStride * height <= frame.length && (frame[row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 0 : 255
  }
  return { width, height, data: out }
}

/** Turn whatever the site served (PNG, JPEG, WebP, GIF, SVG, ICO with PNG or BMP frames) into something sharp reads. */
async function normaliseImage(data: Buffer): Promise<Buffer | null> {
  const frames = icoFrames(data)
  if (!frames.length) return data
  const best = frames[0]
  if (best.png) return best.png
  const bitmap = best.bmp && rgbaFromIcoBmp(best.bmp)
  return bitmap ? sharp(bitmap.data, { raw: { width: bitmap.width, height: bitmap.height, channels: 4 } }).png().toBuffer() : null
}

export type LogoAttempt = { url: string; result: string }
type ImageResult = { image: Buffer; size: number } | { reason: string }
async function fetchImage(url: string, jar?: CookieJar, referer?: string): Promise<ImageResult> {
  try {
    let data: Buffer
    const inline = url.match(/^data:(image\/[\w.+-]+)?(;base64)?,(.*)$/is)
    if (inline) data = inline[2] ? Buffer.from(inline[3], 'base64') : Buffer.from(decodeURIComponent(inline[3]))
    else {
      const { response } = await fetchFollow(url, 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5', jar, referer)
      if (!response.ok) { await response.body?.cancel(); return { reason: `HTTP ${response.status}` } }
      const type = response.headers.get('content-type') || ''
      data = await readLimited(response, MAX_IMAGE)
      if (/text\/html/i.test(type) && !/^\s*<(\?xml|svg)/i.test(data.subarray(0, 256).toString('utf8'))) return { reason: '返回的是网页而不是图片' }
    }
    if (!data.length) return { reason: '空文件' }
    const readable = await normaliseImage(data)
    if (!readable) return { reason: '无法解析的 ICO 格式' }
    const meta = await sharp(readable, { density: 300 }).metadata().catch(() => null)
    if (!meta?.width || !meta.height) return { reason: '无法识别的图片格式' }
    const size = Math.min(meta.width, meta.height)
    if (size < MIN_ICON) return { reason: `太小（${meta.width}×${meta.height}）` }
    const image = await sharp(readable, { density: 300 }).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 }).toBuffer()
    return { image, size: meta.format === 'svg' ? 1024 : size }
  } catch (error) { return { reason: error instanceof Error ? (error.message === 'response too large' ? '文件超过 2 MB' : error.message) : '请求失败' } }
}

/** Try icon candidates in order and keep the largest; stop early once one is big enough. Returns every attempt for diagnosis. */
export async function discoverLogo(html: string, base: string, jar?: CookieJar): Promise<{ image: Buffer | null; attempts: LogoAttempt[] }> {
  const { icons, manifest } = discoverIcons(html, base)
  const candidates = [...icons], attempts: LogoAttempt[] = []
  if (manifest) {
    try {
      const { response } = await fetchFollow(manifest, 'application/manifest+json,application/json', jar, base)
      const json = JSON.parse((await readLimited(response, 64 * 1024)).toString('utf8')) as { icons?: { src?: string; sizes?: string }[] }
      const sized = (json.icons || []).filter(icon => icon.src).sort((a, b) => (Number(b.sizes?.split('x')[0]) || 0) - (Number(a.sizes?.split('x')[0]) || 0))
      candidates.push(...sized.map(icon => new URL(icon.src!, manifest).href))
    } catch { attempts.push({ url: manifest, result: 'manifest 读取失败' }) }
  }
  candidates.push(new URL('/favicon.ico', base).href)
  let best: { image: Buffer; size: number } | null = null
  for (const candidate of [...new Set(candidates)].slice(0, 8)) {
    const result = await fetchImage(candidate, jar, base)
    attempts.push({ url: candidate.startsWith('data:') ? `${candidate.slice(0, 40)}…` : candidate, result: 'image' in result ? `OK ${result.size >= 1024 ? 'SVG' : `${result.size}px`}` : result.reason })
    if ('image' in result && (!best || result.size > best.size)) best = result
    if (best && best.size >= GOOD_ICON) break
  }
  return { image: best?.image || null, attempts }
}

/** One-shot logo check for a URL (admin "fetch now" and the diagnostic script). */
export async function inspectLogo(url: string) {
  const jar: CookieJar = new Map()
  const page = await probe(url, jar)
  const pageNote = page.ok ? page.html ? `首页 HTTP ${page.status}` : `首页 HTTP ${page.status ?? '?'}（未拿到 HTML，只能试 /favicon.ico）` : `首页无法访问${page.status ? `（HTTP ${page.status}）` : ''}`
  if (!page.ok) return { image: null, attempts: [] as LogoAttempt[], page: pageNote }
  return { ...await discoverLogo(page.html || '', page.finalURL || url, jar), page: pageNote }
}
export const logoSummary = (now: number, page: string, attempts: LogoAttempt[], ok: boolean) =>
  `${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(now)} UTC+8 · ${ok ? '已更新' : '失败'} · ${page}${attempts.length ? `\n${attempts.map(item => `${item.result} ← ${item.url}`).join('\n')}` : ''}`.slice(0, 1000)

const stale = (value: string | null | undefined, every: number, now: number) => !value || now - Date.parse(value) >= every

/** Store a freshly fetched logo as media and swap it in; the old auto logo is deleted. */
export async function saveLogo(payload: Payload, friend: LogoFriend, image: Buffer, now: number) {
  const logoID = typeof friend.logo === 'object' ? friend.logo?.id : friend.logo
  const media = await payload.create({ collection: 'media', overrideAccess: true, data: { alt: `${friend.name} logo`, altEn: `${friend.name} logo`, source: friend.url, visibility: 'public' },
    file: { data: image, mimetype: 'image/webp', name: `pit-logo-${friend.tla.toLowerCase()}-${now}.webp`, size: image.length } })
  if (logoID) await payload.delete({ collection: 'media', id: logoID, overrideAccess: true }).catch(() => undefined)
  return media.id
}

export async function checkFriend(payload: Payload, friend: FriendDoc, now = Date.now()) {
  const jar: CookieJar = new Map()
  const result = await probe(friend.url, jar)
  const health = nextHealth(friend.health, result)
  const data: Record<string, unknown> = { health: { ...health, checkedAt: new Date(now).toISOString() } }
  const base = result.finalURL || friend.url
  const logoID = typeof friend.logo === 'object' ? friend.logo?.id : friend.logo
  if (result.ok && friend.logoSource === 'auto' && stale(friend.logoCheckedAt, logoID ? LOGO_EVERY : LOGO_RETRY, now)) {
    data.logoCheckedAt = new Date(now).toISOString()
    const { image, attempts } = await discoverLogo(result.html || '', base, jar)
    const page = result.html ? `首页 HTTP ${result.status}` : `首页 HTTP ${result.status ?? '?'}（未拿到 HTML，只能试 /favicon.ico）`
    try {
      if (image) data.logo = await saveLogo(payload, friend, image, now)
      data.logoStatus = logoSummary(now, page, attempts, Boolean(image))
    } catch (error) { data.logoStatus = logoSummary(now, `${page} · 保存到媒体库失败：${error instanceof Error ? error.message : error}`, attempts, false) }
    if (!image) payload.logger.warn(`PIT LANE ${friend.tla}: logo 抓取失败 — ${attempts.map(item => item.result).join(' / ') || page}`)
  }
  if (friend.health?.state !== health.state) payload.logger.info(`PIT LANE ${friend.tla}: ${friend.health?.state || 'green'} → ${health.state}`)
  await payload.update({ collection: 'friends', id: friend.id, data, overrideAccess: true, depth: 0, context: { monitor: true } })
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
