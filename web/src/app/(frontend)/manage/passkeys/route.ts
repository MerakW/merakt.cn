import { createHash, randomBytes } from 'node:crypto'
import { createLocalReq, getPayload, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie, parseCookies } from 'payload/shared'
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import config from '@payload-config'

export const runtime = 'nodejs'
const json = (data: unknown, status = 200, cookie?: string) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) },
})
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
class Rejected extends Error { constructor(message: string, public status = 400) { super(message) } }

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const site = new URL(payload.config.serverURL)
  if (request.headers.get('origin') !== site.origin) return json({ error: '请从本站管理页面操作。' }, 403)
  if (site.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(site.hostname)) {
    return json({ error: '通行密钥需要 HTTPS；请通过正式域名访问。' }, 400)
  }
  const cookieName = `${payload.config.cookiePrefix}-passkey`
  const challengeCookie = (value: string, expires = 300) => `${cookieName}=${value}; Path=/manage/passkeys; HttpOnly; SameSite=Strict; Max-Age=${expires}${site.protocol === 'https:' ? '; Secure' : ''}`
  // Bound the body before parsing attestation data supplied by an anonymous client.
  let body: Record<string, unknown>
  try {
    const reader = request.body?.getReader()
    if (!reader) throw new Error()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > 32_768) { await reader.cancel(); return json({ error: '请求内容过大。' }, 413) }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
  } catch { return json({ error: '请求格式无效。' }, 400) }
  const { user } = await payload.auth({ headers: request.headers })
  const action = body.action
  const token = parseCookies(request.headers).get(cookieName) || ''
  const tokenHash = hash(token)
  try {
    if (action !== 'login-options' && action !== 'login-verify' && !user) throw new Rejected('请先用密码登录。', 401)
    if (action === 'list') {
      const keys = await payload.find({ collection: 'passkeys', depth: 0, pagination: false, where: { user: { equals: user!.id } } })
      return json({ keys: keys.docs.map(key => ({ id: key.id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt })) })
    }
    if (action === 'remove') {
      if (typeof body.id !== 'number') throw new Rejected('请选择通行密钥。')
      await payload.delete({ collection: 'passkeys', where: { and: [{ id: { equals: body.id } }, { user: { equals: user!.id } }] } })
      return json({ ok: true })
    }
    if (action === 'login-options' || action === 'register-options') {
      let renewedCookie: string | undefined
      if (action === 'register-options') {
        if (typeof body.password !== 'string' || !body.password) throw new Rejected('绑定前请确认当前密码。')
        try {
          const login = await payload.login({ collection: 'users', data: { email: user!.email, password: body.password } })
          renewedCookie = generatePayloadCookie({ collectionAuthConfig: { ...payload.collections.users.config.auth, cookies: { ...payload.collections.users.config.auth.cookies, sameSite: 'Lax', secure: site.protocol === 'https:' } }, cookiePrefix: payload.config.cookiePrefix, token: login.token! })
        } catch { throw new Rejected('密码不正确，或账号暂时被锁定。', 401) }
      }
      const existing = user && action === 'register-options' ? await payload.find({ collection: 'passkeys', depth: 0, pagination: false, where: { user: { equals: user.id } } }) : null
      if (existing && existing.docs.length >= 10) throw new Rejected('最多绑定 10 个通行密钥，请先删除旧密钥。')
      const options = action === 'login-options'
        ? await generateAuthenticationOptions({ rpID: site.hostname, userVerification: 'required', timeout: 60_000 })
        : await generateRegistrationOptions({ rpName: 'Merak 控制台', rpID: site.hostname,
          userID: new Uint8Array(Buffer.from(`merak-user-${user!.id}`)), userName: user!.email, userDisplayName: user!.name,
          attestationType: 'none', authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          excludeCredentials: existing!.docs.map(key => ({ id: key.credentialID })), timeout: 60_000 })
      await payload.delete({ collection: 'passkey-challenges', where: { or: [{ expiresAt: { less_than: new Date().toISOString() } }, { tokenHash: { equals: tokenHash } }] } })
      const count = await payload.count({ collection: 'passkey-challenges' })
      if (count.totalDocs >= 1000) throw new Rejected('验证服务繁忙，请稍后重试。', 429)
      const nextToken = randomBytes(32).toString('base64url')
      await payload.create({ collection: 'passkey-challenges', data: { tokenHash: hash(nextToken), challenge: options.challenge,
        purpose: action === 'login-options' ? 'login' : 'register', userID: action === 'register-options' ? user!.id : undefined,
        expiresAt: new Date(Date.now() + 300_000).toISOString() } })
      const response = json({ options }, 200, challengeCookie(nextToken))
      if (renewedCookie) response.headers.append('Set-Cookie', renewedCookie)
      return response
    }
    if (action !== 'login-verify' && action !== 'register-verify') throw new Rejected('操作无效。')
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Rejected('验证已过期，请重新开始。')
    // An immediate SQLite transaction makes each challenge consumable exactly once,
    // even for simultaneous requests or passkeys whose signature counter is always zero.
    const consumeID = await payload.db.beginTransaction()
    if (consumeID == null) throw new Rejected('验证服务暂不可用。', 503)
    let challenge
    try {
      const consumed = await payload.delete({ collection: 'passkey-challenges', req: { transactionID: consumeID },
        where: { and: [{ tokenHash: { equals: tokenHash } }, { expiresAt: { greater_than: new Date().toISOString() } },
          { purpose: { equals: action === 'login-verify' ? 'login' : 'register' } },
          ...(action === 'register-verify' ? [{ userID: { equals: user!.id } }] : [])] } })
      challenge = consumed.docs[0]
      await payload.db.commitTransaction(consumeID)
    } catch (error) { await payload.db.rollbackTransaction(consumeID); throw error }
    if (!challenge) throw new Rejected('验证已过期或已使用，请重新开始。')
    if (action === 'register-verify') {
      const result = await verifyRegistrationResponse({ response: body.credential as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge, expectedOrigin: site.origin, expectedRPID: site.hostname, requireUserVerification: true })
      if (!result.verified || !result.registrationInfo) throw new Rejected('通行密钥验证失败。')
      const credential = result.registrationInfo.credential
      await payload.create({ collection: 'passkeys', data: { user: user!.id, credentialID: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
        transports: credential.transports, name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : '我的通行密钥' } })
      return json({ ok: true }, 200, challengeCookie('', 0))
    }
    const credential = body.credential as AuthenticationResponseJSON
    if (!credential || typeof credential.id !== 'string') throw new Rejected('验证失败，请重新尝试。')
    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) throw new Rejected('验证服务暂不可用。', 503)
    try {
      const req = await createLocalReq({ req: { transactionID } }, payload)
      const keys = await payload.find({ collection: 'passkeys', depth: 0, limit: 1, req, where: { credentialID: { equals: credential.id } } })
      const key = keys.docs[0]
      if (!key || typeof key.user !== 'number') throw new Rejected('此通行密钥未绑定本站账号。', 401)
      if (credential.response.userHandle !== Buffer.from(`merak-user-${key.user}`).toString('base64url')) throw new Rejected('账号验证失败。', 401)
      const result = await verifyAuthenticationResponse({ response: credential, expectedChallenge: challenge.challenge,
        expectedOrigin: site.origin, expectedRPID: site.hostname, requireUserVerification: true,
        credential: { id: key.credentialID, publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')), counter: key.counter } })
      if (!result.verified) throw new Rejected('通行密钥验证失败。', 401)
      const account = await payload.findByID({ collection: 'users', id: key.user, req, showHiddenFields: true })
      if (account.lockUntil && new Date(account.lockUntil).getTime() > Date.now()) throw new Rejected('账号暂时被锁定，请稍后重试。', 401)
      await payload.update({ collection: 'passkeys', id: key.id, req, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() } })
      const collectionConfig = payload.collections.users.config
      const { sid } = await addSessionToUser({ payload, req, collectionConfig, user: { ...account, collection: 'users' } })
      const { token: authToken } = await jwtSign({ secret: payload.secret, tokenExpiration: collectionConfig.auth.tokenExpiration,
        fieldsToSign: { id: account.id, email: account.email, collection: 'users', sid } })
      await payload.db.commitTransaction(transactionID)
      const response = json({ ok: true }, 200, challengeCookie('', 0))
      response.headers.append('Set-Cookie', generatePayloadCookie({ collectionAuthConfig: { ...collectionConfig.auth, cookies: { ...collectionConfig.auth.cookies, sameSite: 'Lax', secure: site.protocol === 'https:' } }, cookiePrefix: payload.config.cookiePrefix, token: authToken }))
      return response
    } catch (error) { await payload.db.rollbackTransaction(transactionID); throw error }
  } catch (error) {
    return json({ error: error instanceof Rejected ? error.message : '通行密钥验证失败，请重新尝试。' }, error instanceof Rejected ? error.status : 400)
  }
}
