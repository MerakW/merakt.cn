/** Run against an isolated local fixture server; never send test credentials to production. */
import assert from 'node:assert/strict'
const base = new URL(process.env.PREVIEW_ACCESS_TEST_URL || 'http://127.0.0.1:3005')
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'Use a disposable localhost test server')
const email = process.env.PREVIEW_ACCESS_TEST_EMAIL
const password = process.env.PREVIEW_ACCESS_TEST_PASSWORD
assert.ok(email && password, 'Provide the isolated fixture administrator credentials')
const routes = ['/status-preview', '/red-flag-preview', '/maintenance-preview']
for (const path of routes) {
  for (const cookie of ['', 'merak-preview-token=forged; payload-token=forged']) {
    const response = await fetch(new URL(path, base), { headers: { cookie, 'Sec-Fetch-Site': 'same-origin' } })
    assert.equal(response.status, 404, `${path}: anonymous/forged sessions must return HTTP 404`)
    await response.text()
  }
}
const login = await fetch(new URL('/api/users/login', base), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
})
assert.equal(login.status, 200, 'Fixture administrator must authenticate')
const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
assert.ok(cookie, 'Login must issue a session cookie')
await login.text()
for (const path of routes) {
  const response = await fetch(new URL(path, base), { headers: { cookie, 'Sec-Fetch-Site': 'same-origin' } })
  assert.equal(response.status, 200, `${path}: authenticated administrator can preview`)
  assert.match(response.headers.get('cache-control') || '', /no-store/i)
  await response.text()
}
console.log('PASS: all three previews return HTTP 404 for anonymous/forged sessions and 200 without caching for administrators.')
