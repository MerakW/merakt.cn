import assert from 'node:assert/strict'
import test from 'node:test'
import { garageMail, hashPassword, hashToken, newToken, normalEmail, readSession, sessionToken, validPassword, verifyPassword } from '../src/lib/pit-garage'

test('garage passwords are salted scrypt hashes and verify only the right password', async () => {
  const one = await hashPassword('correct horse'), two = await hashPassword('correct horse')
  assert.match(one, /^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{86}$/)
  assert.notEqual(one, two)
  assert.equal(await verifyPassword('correct horse', one), true)
  assert.equal(await verifyPassword('correct hors', one), false)
  assert.equal(await verifyPassword('correct horse', null), false)
  assert.equal(await verifyPassword('correct horse', 'plain-text'), false)
  assert.equal(validPassword('1234567'), false); assert.equal(validPassword('12345678'), true); assert.equal(validPassword('x'.repeat(129)), false)
  assert.equal(normalEmail(' YX@Example.COM '), 'yx@example.com'); assert.equal(normalEmail('not-an-email'), null)
})

test('garage sessions are signed, versioned and expire', () => {
  const now = Date.parse('2026-11-08T00:00:00Z'), token = sessionToken('secret-a', { id: 12, sessionVersion: 3 }, now)
  assert.deepEqual(readSession('secret-a', token, now + 1000), { id: 12, version: 3 })
  assert.equal(readSession('secret-b', token, now), null)
  assert.equal(readSession('secret-a', token.replace(/^12\./, '13.'), now), null)
  assert.equal(readSession('secret-a', token, now + 8 * 86400000), null)
  assert.equal(readSession('secret-a', undefined, now), null)
  assert.equal(readSession('secret-a', 'garbage', now), null)
})

test('garage mails keep one-time tokens in the fragment and escape names', () => {
  const token = newToken()
  assert.match(token, /^[\w-]{43}$/); assert.notEqual(hashToken(token), token)
  const mail = garageMail('invite', { tla: 'AST', name: '<b>Aster</b>' }, `https://merakt.cn/pit-lane/garage#invite=${token}`)
  assert.match(mail.subject, /AST/)
  assert.ok(mail.text.includes(`#invite=${token}`))
  assert.ok(!mail.html.includes('<b>Aster</b>') && mail.html.includes('&#60;b&#62;Aster'))
  assert.match(garageMail('approved', { tla: 'AST', name: 'Aster' }, 'https://merakt.cn/pit-lane/garage').text, /已通过/)
})
