import type { Payload, PayloadRequest } from 'payload'
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { FRIEND_TYRES, HEX_PATTERN, safeHttpURL, type FriendTyre } from './pit-lane'
import { readJSON, reply, text, trustedOrigin } from './pit-lane-request'
import { EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN } from './pit-garage-rules'
import { garageMail, type GarageMail } from './pit-garage-mail'

/**
 * Garage: optional self-service accounts for Pit Lane friends. Deliberately separate from Payload auth,
 * so a friend's session never becomes `req.user` (every admin check on the site treats req.user as Merak).
 * One account per friend card; login opens only once the card is approved and loginEnabled is set.
 */
const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const SESSION_TTL = 7 * 86400000
const RESET_TTL = 3600000, INVITE_TTL = 72 * 3600000
const MAX_FAILURES = 5, LOCK_MS = 10 * 60000

export type GarageFriend = {
  id: number; tla: string; name: string; url: string; status: string; teamColor: string; bio?: string | null; coolingMsg?: string | null; contact?: string | null; backlinkUrl?: string | null
  tyreMode?: string | null; tyre?: string | null; maintenance?: boolean | null; bay?: number | null; reviewNote?: string | null; accountEmail?: string | null; loginEnabled?: boolean | null
  passwordHash?: string | null; sessionVersion?: number | null; resetTokenHash?: string | null; resetExpires?: string | null; loginFailures?: number | null; lockedUntil?: string | null
}

// ---- passwords ----
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16), hash = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [kind, N, r, p, salt, hash] = (stored || DUMMY).split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length || 64, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem }).catch(() => null)
  return Boolean(stored && actual && actual.length === expected.length && timingSafeEqual(actual, expected))
}
export const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
export const normalEmail = (value: unknown) => typeof value === 'string' && EMAIL_PATTERN.test(value.trim()) && value.trim().length <= 120 ? value.trim().toLowerCase() : null

// ---- sessions & tokens ----
const key = (secret: string) => createHash('sha256').update(`${secret}:pit-garage`).digest()
const sign = (secret: string, body: string) => createHmac('sha256', key(secret)).update(body).digest('base64url')
export function sessionToken(secret: string, friend: Pick<GarageFriend, 'id' | 'sessionVersion'>, now = Date.now()): string {
  const body = `${friend.id}.${friend.sessionVersion || 0}.${now + SESSION_TTL}`
  return `${body}.${sign(secret, body)}`
}
export function readSession(secret: string, token: string | undefined, now = Date.now()): { id: number; version: number } | null {
  const match = token?.match(/^(\d{1,9})\.(\d{1,9})\.(\d{13})\.([\w-]{43})$/)
  if (!match) return null
  const expected = Buffer.from(sign(secret, `${match[1]}.${match[2]}.${match[3]}`)), given = Buffer.from(match[4])
  if (expected.length !== given.length || !timingSafeEqual(expected, given) || Number(match[3]) < now) return null
  return { id: Number(match[1]), version: Number(match[2]) }
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')

const cookieName = (payload: Payload) => `${payload.config.cookiePrefix}-garage`
function cookie(req: PayloadRequest, value: string, maxAge: number): string {
  const secure = new URL(req.payload.config.serverURL).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(req.payload)}=${value}; Path=/api/friends/garage; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAge / 1000)}${secure}`
}
const json = (body: unknown, status = 200, setCookie?: string) => {
  const headers = new Headers({ 'Cache-Control': 'no-store' }); if (setCookie) headers.set('Set-Cookie', setCookie)
  return Response.json(body, { status, headers })
}
const cookieValue = (req: PayloadRequest) => req.headers.get('cookie')?.split(/;\s*/).find(part => part.startsWith(`${cookieName(req.payload)}=`))?.slice(cookieName(req.payload).length + 1)

async function friendBy(payload: Payload, where: Record<string, unknown>): Promise<GarageFriend | undefined> {
  const { docs } = await payload.find({ collection: 'friends', where: where as never, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  return docs[0] as unknown as GarageFriend | undefined
}
const canLogin = (friend: GarageFriend | undefined): boolean => Boolean(friend && friend.status === 'approved' && friend.loginEnabled && friend.accountEmail)
/** Fields stored by the garage itself; never through the admin form. */
const internal = (payload: Payload, id: number, data: Record<string, unknown>) => payload.update({ collection: 'friends', id, data, overrideAccess: true, depth: 0, context: { garage: true } })

async function signedIn(req: PayloadRequest): Promise<GarageFriend | null> {
  const session = readSession(req.payload.config.secret, cookieValue(req))
  if (!session) return null
  const friend = await friendBy(req.payload, { id: { equals: session.id } })
  return friend && canLogin(friend) && (friend.sessionVersion || 0) === session.version ? friend : null
}

/** What the garage page may see about its own card; secrets and admin-only state stay out. */
const view = (friend: GarageFriend) => ({
  tla: friend.tla, name: friend.name, url: friend.url, teamColor: friend.teamColor, bio: friend.bio || '', coolingMsg: friend.coolingMsg || '', contact: friend.contact || '', backlinkUrl: friend.backlinkUrl || '',
  tyre: friend.tyreMode === 'manual' && friend.tyre ? friend.tyre : 'auto', maintenance: Boolean(friend.maintenance), bay: friend.bay ?? null, email: friend.accountEmail, note: friend.reviewNote || '',
})

// ---- rate limits (per process; proxies may add more) ----
const windows = new Map<string, number[]>()
function limited(bucket: string, max: number, span = 60000): boolean {
  const now = Date.now(), list = windows.get(bucket) || []
  while (list.length && list[0] < now - span) list.shift()
  if (windows.size > 5000) windows.clear()
  if (list.length >= max) { windows.set(bucket, list); return true }
  list.push(now); windows.set(bucket, list); return false
}
const client = (req: PayloadRequest) => req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

async function post(req: PayloadRequest): Promise<Record<string, unknown> | Response> {
  if (!trustedOrigin(req)) return reply('pitLane.error.origin', 403)
  return readJSON(req, 4096)
}

// ---- endpoints ----
export async function garageSession(req: PayloadRequest) {
  try {
    const friend = await signedIn(req)
    return friend ? json({ friend: view(friend) }) : reply('garage.error.signedOut', 401)
  } catch { return reply('pitLane.error.unavailable', 503) }
}

export async function garageLogin(req: PayloadRequest) {
  const data = await post(req); if (data instanceof Response) return data
  const email = normalEmail(data.email), password = typeof data.password === 'string' ? data.password : ''
  if (!email || !password || password.length > PASSWORD_MAX) return reply('garage.error.credentials', 400)
  if (limited(`login:${client(req)}`, 10) || limited(`login:${email}`, 10, 10 * 60000)) return reply('pitLane.error.busy', 429)
  try {
    const friend = await friendBy(req.payload, { accountEmail: { equals: email } })
    if (friend?.lockedUntil && Date.parse(friend.lockedUntil) > Date.now()) { await verifyPassword(password, null); return reply('garage.error.locked', 423) }
    const ok = await verifyPassword(password, friend?.passwordHash)
    if (!friend || !ok) {
      if (friend) { const failures = (friend.loginFailures || 0) + 1; await internal(req.payload, friend.id, failures >= MAX_FAILURES ? { loginFailures: 0, lockedUntil: new Date(Date.now() + LOCK_MS).toISOString() } : { loginFailures: failures }) }
      return reply('garage.error.credentials', 401)
    }
    // Correct password, but Merak has not opened the garage yet.
    if (!canLogin(friend)) return reply(friend.status === 'approved' ? 'garage.error.disabled' : 'garage.error.pending', 403)
    await internal(req.payload, friend.id, { loginFailures: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() })
    return json({ friend: view(friend) }, 200, cookie(req, sessionToken(req.payload.config.secret, friend), SESSION_TTL))
  } catch { return reply('pitLane.error.unavailable', 503) }
}

export async function garageLogout(req: PayloadRequest) {
  if (!trustedOrigin(req)) return reply('pitLane.error.origin', 403)
  return json({ ok: true }, 200, cookie(req, '', 0))
}

export async function garageUpdate(req: PayloadRequest) {
  const data = await post(req); if (data instanceof Response) return data
  try {
    const friend = await signedIn(req)
    if (!friend) return reply('garage.error.signedOut', 401)
    if (limited(`update:${friend.id}`, 20)) return reply('pitLane.error.busy', 429)
    const name = text(data.name, 40), bio = text(data.bio ?? '', 40), coolingMsg = text(data.coolingMsg ?? '', 24), contact = text(data.contact ?? '', 80)
    const teamColor = typeof data.teamColor === 'string' && HEX_PATTERN.test(data.teamColor) ? data.teamColor.toLowerCase() : null
    const tyre = data.tyre === 'auto' || !data.tyre ? null : FRIEND_TYRES.includes(String(data.tyre) as FriendTyre) ? String(data.tyre) : undefined
    const backlinkText = text(data.backlinkUrl ?? '', 200), backlinkUrl = backlinkText ? safeHttpURL(backlinkText) : ''
    if (!name) return reply('pitLane.error.name', 400)
    if (!teamColor) return reply('pitLane.error.color', 400)
    if (bio === null || coolingMsg === null || contact === null || tyre === undefined || backlinkText === null || backlinkUrl === undefined || typeof (data.maintenance ?? false) !== 'boolean') return reply('pitLane.error.invalid', 400)
    // TLA, site URL, review state and account email stay with Merak.
    const updated = await internal(req.payload, friend.id, { name, bio: bio || null, coolingMsg: coolingMsg || null, contact: contact || null, teamColor, backlinkUrl: backlinkUrl || null,
      tyreMode: tyre ? 'manual' : 'auto', tyre: tyre || null, maintenance: Boolean(data.maintenance) })
    req.payload.logger.info(`PIT GARAGE ${friend.tla}: card updated by the team`)
    return json({ friend: view({ ...friend, ...(updated as unknown as GarageFriend) }) })
  } catch { return reply('pitLane.error.unavailable', 503) }
}

export async function garagePassword(req: PayloadRequest) {
  const data = await post(req); if (data instanceof Response) return data
  try {
    const friend = await signedIn(req)
    if (!friend) return reply('garage.error.signedOut', 401)
    if (limited(`password:${friend.id}`, 5)) return reply('pitLane.error.busy', 429)
    if (!validPassword(data.next)) return reply('garage.error.weak', 400)
    if (typeof data.current !== 'string' || !await verifyPassword(data.current, friend.passwordHash)) return reply('garage.error.current', 401)
    const sessionVersion = (friend.sessionVersion || 0) + 1
    await internal(req.payload, friend.id, { passwordHash: await hashPassword(data.next), passwordSetAt: new Date().toISOString(), sessionVersion, resetTokenHash: null, resetExpires: null })
    // Other devices are signed out; this one gets a fresh session.
    return json({ ok: true }, 200, cookie(req, sessionToken(req.payload.config.secret, { id: friend.id, sessionVersion }), SESSION_TTL))
  } catch { return reply('pitLane.error.unavailable', 503) }
}

/** Always answers the same way, so it cannot be used to discover which emails have accounts. */
export async function garageForgot(req: PayloadRequest) {
  const data = await post(req); if (data instanceof Response) return data
  const email = normalEmail(data.email)
  if (!email) return reply('garage.error.email', 400)
  if (limited(`forgot:${client(req)}`, 5) || limited(`forgot:${email}`, 3, 30 * 60000)) return reply('pitLane.error.busy', 429)
  try {
    const friend = await friendBy(req.payload, { accountEmail: { equals: email } })
    if (friend && canLogin(friend)) await sendGarageMail(req.payload, friend, 'reset', req)
  } catch (error) { req.payload.logger.error({ err: error }, 'PIT GARAGE reset mail failed') }
  return json({ ok: true }, 202)
}

export async function garageReset(req: PayloadRequest) {
  const data = await post(req); if (data instanceof Response) return data
  const token = typeof data.token === 'string' && /^[\w-]{43}$/.test(data.token) ? data.token : null
  if (!token) return reply('garage.error.token', 400)
  if (!validPassword(data.password)) return reply('garage.error.weak', 400)
  if (limited(`reset:${client(req)}`, 10)) return reply('pitLane.error.busy', 429)
  try {
    const friend = await friendBy(req.payload, { resetTokenHash: { equals: hashToken(token) } })
    if (!friend || !friend.resetExpires || Date.parse(friend.resetExpires) < Date.now()) return reply('garage.error.token', 400)
    const sessionVersion = (friend.sessionVersion || 0) + 1
    await internal(req.payload, friend.id, { passwordHash: await hashPassword(data.password), passwordSetAt: new Date().toISOString(), sessionVersion, resetTokenHash: null, resetExpires: null, loginFailures: 0, lockedUntil: null })
    if (!canLogin(friend)) return reply(friend.status === 'approved' ? 'garage.error.disabled' : 'garage.error.pending', 403)
    return json({ friend: view(friend) }, 200, cookie(req, sessionToken(req.payload.config.secret, { id: friend.id, sessionVersion }), SESSION_TTL))
  } catch { return reply('pitLane.error.unavailable', 503) }
}

// ---- mail (sent from the configured no-reply mailbox; see SMTP_* in .env.example; template in ./pit-garage-mail) ----
export { garageMail, type GarageMail } from './pit-garage-mail'

/** Invite and reset mails carry a fresh one-time token; approval mails just link to the garage. */
export async function sendGarageMail(payload: Payload, friend: GarageFriend, kind: GarageMail, req?: PayloadRequest) {
  if (!friend.accountEmail) return
  const base = new URL('/pit-lane/garage', payload.config.serverURL).href
  let link = base
  if (kind !== 'approved') {
    const token = newToken()
    await payload.update({ collection: 'friends', id: friend.id, overrideAccess: true, depth: 0, context: { garage: true }, req, data: { resetTokenHash: hashToken(token), resetExpires: new Date(Date.now() + (kind === 'invite' ? INVITE_TTL : RESET_TTL)).toISOString() } })
    // Fragment, not query: the token never reaches server logs or Referer headers.
    link = `${base}#${kind === 'invite' ? 'invite' : 'reset'}=${token}`
  }
  const mail = garageMail(kind, friend, link)
  await payload.sendEmail({ to: friend.accountEmail, ...mail })
  payload.logger.info(`PIT GARAGE ${friend.tla}: ${kind} mail sent`)
}
