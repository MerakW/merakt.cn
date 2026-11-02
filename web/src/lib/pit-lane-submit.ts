import type { PayloadRequest } from 'payload'
import { createHash, randomInt } from 'node:crypto'
import { FRIEND_TYRES, HEX_PATTERN, RESERVED_TLAS, TLA_PATTERN, safeHttpURL, type FriendTyre } from './pit-lane'
import { TICKET_PATTERN } from './pit-lane-card'
import { verifyBacklink } from './pit-lane-monitor'

const recent: number[] = [], lookups: number[] = []
const TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const hashTicket = (ticket: string) => createHash('sha256').update(ticket).digest('hex')
const newTicket = (tla: string) => `PIT-${tla}-${Array.from({ length: 6 }, () => TICKET_ALPHABET[randomInt(TICKET_ALPHABET.length)]).join('')}`
const limited = (window: number[], max: number) => { const now = Date.now(); while (window.length && window[0] < now - 60000) window.shift(); if (window.length >= max) return true; window.push(now); return false }
/** Errors are i18n keys; the Stewards' Desk translates them client-side. */
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null

function trustedOrigin(req: PayloadRequest): boolean {
  const origin = req.headers.get('origin')
  if (origin === new URL(req.payload.config.serverURL).origin) return true
  if (process.env.LOCAL_PREVIEW !== '1' || !origin) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'http:' && url.host === req.headers.get('host') && /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname)
  } catch { return false }
}

export async function submitFriendApplication(req: PayloadRequest) {
  if (!trustedOrigin(req)) return reply('pitLane.error.origin', 403)
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply('pitLane.error.format', 415)
  const reader = req.body?.getReader()
  if (!reader) return reply('pitLane.error.format', 400)
  let data: Record<string, unknown>
  try {
    let size = 0; const chunks: Uint8Array[] = []
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); return reply('pitLane.error.tooLarge', 413) } chunks.push(value) }
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return reply('pitLane.error.format', 400) }
  if (!data || typeof data !== 'object' || data.website) return reply('pitLane.error.invalid', 400)

  const tla = typeof data.tla === 'string' ? data.tla.trim().toUpperCase() : ''
  const name = text(data.name, 40), bio = text(data.bio ?? '', 40), coolingMsg = text(data.coolingMsg ?? '', 24), contact = text(data.contact ?? '', 80)
  const url = typeof data.url === 'string' ? safeHttpURL(data.url.trim()) : undefined
  const teamColor = typeof data.teamColor === 'string' && HEX_PATTERN.test(data.teamColor) ? data.teamColor.toLowerCase() : null
  const tyre = data.tyre === undefined || data.tyre === '' || data.tyre === 'auto' ? null : FRIEND_TYRES.includes(String(data.tyre) as FriendTyre) ? String(data.tyre) as FriendTyre : undefined
  const backlinkText = text(data.backlinkUrl ?? '', 200), backlinkUrl = backlinkText ? safeHttpURL(backlinkText) : ''
  if (!TLA_PATTERN.test(tla) || RESERVED_TLAS.has(tla)) return reply('pitLane.error.tla', 400)
  if (!name) return reply('pitLane.error.name', 400)
  if (!url?.startsWith('https://')) return reply('pitLane.error.url', 400)
  if (!teamColor) return reply('pitLane.error.color', 400)
  if (bio === null || coolingMsg === null || contact === null || tyre === undefined || backlinkText === null || backlinkUrl === undefined) return reply('pitLane.error.invalid', 400)
  if (data.consent !== true) return reply('pitLane.error.consent', 400)

  // Bounded per-process ceiling; persistent/proxy limits belong to deployment configuration.
  if (limited(recent, 10)) return reply('pitLane.error.busy', 429)
  try {
    const taken = await req.payload.count({ collection: 'friends', where: { tla: { equals: tla } }, overrideAccess: true })
    if (taken.totalDocs) return reply('pitLane.error.taken', 409)
    const ticket = newTicket(tla)
    const created = await req.payload.create({ collection: 'friends', overrideAccess: true, data: {
      tla, name, url, teamColor, bio: bio || undefined, coolingMsg: coolingMsg || undefined, contact: contact || undefined, backlinkUrl: backlinkUrl || undefined,
      tyreMode: tyre ? 'manual' : 'auto', tyre: tyre || undefined, logoSource: 'auto', status: 'pending', maintenance: false, source: 'web', ticketHash: hashTicket(ticket),
    } })
    // Look for the reciprocal merakt.cn link in the background; the ticket page reports it.
    void verifyBacklink([url, backlinkUrl].filter(Boolean) as string[]).then(async found => { if (found) await req.payload.update({ collection: 'friends', id: created.id, overrideAccess: true, depth: 0, data: { backlinkAt: new Date().toISOString() } }) }).catch(() => undefined)
    return Response.json({ accepted: true, tla, ticket }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch { return reply('pitLane.error.unavailable', 503) }
}

/** GET /api/friends/clearance?ticket=PIT-AST-XXXXXX — application status for applicants without accounts. */
export async function friendClearance(req: PayloadRequest) {
  const ticket = new URL(req.url || '', 'http://local').searchParams.get('ticket')?.trim().toUpperCase() || ''
  if (!TICKET_PATTERN.test(ticket)) return reply('pitLane.error.ticket', 400)
  if (limited(lookups, 60)) return reply('pitLane.error.busy', 429)
  try {
    const { docs } = await req.payload.find({ collection: 'friends', where: { ticketHash: { equals: hashTicket(ticket) } }, limit: 1, depth: 0, overrideAccess: true })
    const friend = docs[0] as { tla: string; status: string; backlinkAt?: string | null; createdAt: string } | undefined
    if (!friend) return reply('pitLane.error.ticketUnknown', 404)
    return Response.json({ tla: friend.tla, status: friend.status, backlink: Boolean(friend.backlinkAt), submittedAt: friend.createdAt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return reply('pitLane.error.unavailable', 503) }
}
