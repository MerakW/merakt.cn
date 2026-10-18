import test from 'node:test'
import assert from 'node:assert/strict'
import { recoveryTime, beijingInput, maintenanceExpired } from '../src/lib/maintenance-time'
test('maintenance estimate uses Beijing time and rejects rolled-over dates', () => {
  assert.equal(recoveryTime('2026-10-19T08:30'), '2026-10-19T00:30:00.000Z')
  assert.equal(beijingInput('2026-10-19T23:30:00Z'), '2026-10-20T07:30')
  assert.equal(recoveryTime(''), null)
  for (const value of ['2026-02-30T08:00', '2026-10-19T24:30', '2026-10-19', 'bad']) assert.throws(() => recoveryTime(value))
})

test('maintenance expires at the configured time and stays on without a valid estimate', () => {
 const end = '2026-10-19T10:00:00.000Z', now = Date.parse(end)
 assert.equal(maintenanceExpired('pit',end,now-1),false)
 assert.equal(maintenanceExpired('pit',end,now),true)
 assert.equal(maintenanceExpired('pit',end,now+1),true)
 for (const value of [null,'','bad']) assert.equal(maintenanceExpired('pit',value,now),false)
 assert.equal(maintenanceExpired('clear',end,now),false)
})
