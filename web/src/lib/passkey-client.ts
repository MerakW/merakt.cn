import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

export async function passkeyRequest(action: string, data: Record<string, unknown> = {}) {
  const response = await fetch('/manage/passkeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '通行密钥操作失败。')
  return result
}
export async function loginWithPasskey() {
  const { options } = await passkeyRequest('login-options')
  const credential = await startAuthentication({ optionsJSON: options })
  await passkeyRequest('login-verify', { credential })
}
export async function registerPasskey(password: string, name: string) {
  const { options } = await passkeyRequest('register-options', { password })
  const credential = await startRegistration({ optionsJSON: options })
  await passkeyRequest('register-verify', { credential, name })
}
export function passkeyError(error: unknown) {
  if (error instanceof Error && ['NotAllowedError', 'AbortError'].includes(error.name)) return '验证已取消或超时，可以重试或使用密码登录。'
  return error instanceof Error ? error.message : '通行密钥操作失败，请重试。'
}
