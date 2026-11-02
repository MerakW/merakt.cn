import type { PayloadRequest } from 'payload'
import { createHash, randomInt } from 'node:crypto'
import { FRIEND_TYRES, HEX_PATTERN, RESERVED_TLAS, TLA_PATTERN, safeHttpURL, type FriendTyre } from './pit-lane'
import { TICKET_PATTERN } from './pit-lane-card'
import { hashPassword, normalEmail, validPassword } from './pit-garage'
import { readJSON, reply, text, trustedOrigin } from './pit-lane-request'

const recent: number[] = [], lookups: number[] = []
const TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const hashTicket = (ticket: string) => createHash('sha256').update(ticket).digest('hex')
const newTicket = (tla: string) => `PIT-${tla}-${Array.from({ length: 6 }, () => TICKET_ALPHABET[randomInt(TICKET_ALPHABET.length)]).join('')}`
const limited = (window: number[], max: number) => { const now = Date.now(); while (window.length && window[0] < now - 60000) window.shift(); if (window.length >= max) return true; window.push(now); return false }
export async function submitFriendApplication(req: PayloadRequest) {
  if (!trustedOrigin(req)) return reply('pitLane.error.origin', 403)
  const data = await readJSON(req, 8192)
  if (data instanceof Response) return data
  if (data.website) return reply('pitLane.error.invalid', 400)

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
  // Optional garage account: created locked, opened only when Merak approves the card.
  const account = data.account === true, accountEmail = account ? normalEmail(data.accountEmail) : null
  if (account && !accountEmail) return reply('garage.error.email', 400)
  if (account && !validPassword(data.password)) return reply('garage.error.weak', 400)

  // Bounded per-process ceiling; persistent/proxy limits belong to deployment configuration.
  if (limited(recent, 10)) return reply('pitLane.error.busy', 429)
  try {
    const taken = await req.payload.count({ collection: 'friends', where: { tla: { equals: tla } }, overrideAccess: true })
    if (taken.totalDocs) return reply('pitLane.error.taken', 409)
    if (accountEmail && (await req.payload.count({ collection: 'friends', where: { accountEmail: { equals: accountEmail } }, overrideAccess: true })).totalDocs) return reply('garage.error.emailTaken', 409)
    const ticket = newTicket(tla)
    const created = await req.payload.create({ collection: 'friends', overrideAccess: true, data: {
      tla, name, url, teamColor, bio: bio || undefined, coolingMsg: coolingMsg || undefined, contact: contact || undefined, backlinkUrl: backlinkUrl || undefined,
      tyreMode: tyre ? 'manual' : 'auto', tyre: tyre || undefined, logoSource: 'auto', status: 'pending', maintenance: false, source: 'web', ticketHash: hashTicket(ticket),
      ...(accountEmail ? { accountEmail, loginEnabled: false, passwordHash: await hashPassword(data.password as string), passwordSetAt: new Date().toISOString() } : {}),
    }, context: { garage: true } })
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
    const friend = docs[0] as { tla: string; status: string; backlinkAt?: string | null; reviewNote?: string | null; accountEmail?: string | null; createdAt: string } | undefined
    if (!friend) return reply('pitLane.error.ticketUnknown', 404)
    return Response.json({ tla: friend.tla, status: friend.status, backlink: Boolean(friend.backlinkAt), note: friend.reviewNote || undefined, account: Boolean(friend.accountEmail), submittedAt: friend.createdAt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return reply('pitLane.error.unavailable', 503) }
}
