import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { normalizeSyncRequest, parseFR24, FlightSyncError, lookupFlight, pushCalibration } from '../src/lib/flights/sync-provider'

const now = new Date('2026-10-12T10:00:00Z')
const row = {
  identification: { id: 'synthetic-flight', number: { default: 'MU9191' } }, status: { text: 'Landed' },
  airport: { origin: { code: { iata: 'HGH' } }, destination: { code: { iata: 'HND' } } },
  time: { real: { departure: Date.parse('2026-10-12T01:10:00Z') / 1000, arrival: Date.parse('2026-10-12T03:10:00Z') / 1000 }, scheduled: { departure: Date.parse('2026-10-12T01:00:00Z') / 1000, arrival: Date.parse('2026-10-12T03:00:00Z') / 1000 } },
  aircraft: { registration: 'B-TEST', model: { text: 'Test Aircraft', code: 'TEST' } },
}
const response = (rows: unknown[]) => ({ result: { response: { data: rows } } })

test('normalizes IATA/ICAO numbers, rejects unsafe and incomplete matching input', () => {
  assert.equal(normalizeSyncRequest({ flight_number: ' ces 9191 ', origin: 'hgh', date: '2026-10-12' }).flight_number, 'MU9191')
  for (const input of [null, [], { flight_number: '../mu9191' }, { flight_number: 'MU9191', date: '2026-02-30' }, { flight_number: 'MU9191', origin: 'ZZZ' }]) assert.throws(() => normalizeSyncRequest(input), FlightSyncError)
  assert.equal(normalizeSyncRequest({ flight_number: '3U1234' }).flight_number, '3U1234')
})

test('FR24 ignores schedules, estimates, future/stale timestamps and other flight numbers', () => {
  const valid = parseFR24(response([{ ...row, status: { text: 'Scheduled' } }, { ...row, status: { text: 'Estimated' } }, { ...row, identification: { number: { default: 'CA1234' } } }, row]), { flight_number: 'MU9191' }, now)
  assert.equal(valid.registration, 'B-TEST')
  assert.equal(valid.aircraftCode, 'TEST')
  assert.equal(valid.takeoffUTC, '2026-10-12T01:10:00.000Z')
  assert.equal(valid.touchdownUTC, '2026-10-12T03:10:00.000Z')
  assert.equal(valid.departureLocal, '2026-10-12T09:00:00')
  assert.equal(valid.arrivalLocal, '2026-10-12T12:00:00')
  assert.throws(() => parseFR24(response([row]), { flight_number: 'MU9191', origin: 'SHA' }, now), /匹配/)
  assert.throws(() => parseFR24(response([row]), { flight_number: 'MU9191' }, new Date('2026-10-15T00:00:00Z')), /匹配/)
  assert.throws(() => parseFR24(response([row]), { flight_number: 'MU9191' }, new Date('2026-10-12T02:00:00Z')), /匹配/)
  assert.throws(() => parseFR24({}, { flight_number: 'MU9191' }, now), /结构/)
})

test('FR24 selects latest leg for minimal input, but never guesses ambiguous explicit dates', () => {
  const earlier = { ...row, airport: { origin: { code: { iata: 'SHA' } }, destination: { code: { iata: 'HGH' } } }, time: { ...row.time, real: { departure: row.time.real.departure - 3600, arrival: row.time.real.arrival - 3600 } } }
  assert.equal(parseFR24(response([earlier, row]), { flight_number: 'MU9191' }, now).to, 'HND')
  assert.throws(() => parseFR24(response([earlier, row]), { flight_number: 'MU9191', date: '2026-10-12' }, now), /多个航段/)
  assert.equal(parseFR24(response([earlier, row]), { flight_number: 'MU9191', date: '2026-10-12', origin: 'SHA', destination: 'HGH' }, now).from, 'SHA')
})

test('real touchdown can be logged without inventing a missing takeoff from the schedule', () => {
  const partial = { ...row, time: { ...row.time, real: { departure: null, arrival: row.time.real.arrival } } }
  const facts = parseFR24(response([partial]), { flight_number: 'MU9191' }, now)
  assert.equal(facts.takeoffUTC, undefined)
  assert.equal(facts.touchdownUTC, '2026-10-12T03:10:00.000Z')
  assert.equal(facts.departureLocal, '2026-10-12T09:00:00')
})

test('ordinary provider access failure is retriable and Bark uses passive, silent POST without leaking key in URL', async () => {
  const original = globalThis.fetch, originalKey = process.env.BARK_KEY
  try {
    globalThis.fetch = async () => new Response('challenge', { status: 403 })
    await assert.rejects(lookupFlight({ flight_number: 'MU9191' }), (error: unknown) => error instanceof FlightSyncError && error.code === 'provider-http-403' && error.retryable)
    process.env.BARK_KEY = 'synthetic-key'
    globalThis.fetch = async (url, options) => {
      assert.ok(!String(url).includes('synthetic-key'))
      const payload = JSON.parse(String(options?.body))
      assert.equal(payload.title, 'FLIGHT_CALIBRATE_NOW')
      assert.equal(payload.body, 'MU9191|42')
      assert.equal(payload.group, 'FlightSync')
      assert.equal(payload.level, 'passive')
      assert.equal(payload.sound, 'none')
      return Response.json({ code: 200 })
    }
    await pushCalibration('MU9191', '42')
    globalThis.fetch = async () => Response.json({ code: 400 })
    await assert.rejects(pushCalibration('MU9191', '42'), /未确认/)
  } finally { globalThis.fetch = original; if (originalKey === undefined) delete process.env.BARK_KEY; else process.env.BARK_KEY = originalKey }
})

test('Chrome helper validates input, bounds responses, preserves JSON and excludes challenge HTML', () => {
  execFileSync('python3', ['tests/test_fr24_fetch.py'], { stdio: 'pipe' })
})
