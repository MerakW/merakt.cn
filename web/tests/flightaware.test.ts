import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFlightAware } from '../src/lib/flights/flightaware-provider'
import { lookupFlight, FlightSyncError } from '../src/lib/flights/sync-provider'
import { validateWorkerFacts } from '../src/lib/flights/sync-worker'

const request = { flight_number: 'MU9191', date: '2026-10-12', origin: 'SHA', destination: 'PKX' }
const now = new Date('2026-10-13T00:00:00Z')
const row = { ident_icao: 'CES9191', fa_flight_id: 'fixture-only', origin: { code_iata: 'SHA' }, destination: { code_iata: 'PKX' }, scheduled_out: '2026-10-12T01:00:00Z', actual_out: '2026-10-12T01:05:00Z', actual_off: '2026-10-12T01:10:00Z', actual_on: '2026-10-12T03:10:00Z', actual_in: '2026-10-12T03:20:00Z', registration: 'B-TEST', aircraft_type: 'C919' }

test('FlightAware mapping preserves OUT/OFF/ON/IN and cloud accepts normalized facts', () => {
  const facts = parseFlightAware({ flights: [row] }, request, now)
  assert.equal(facts.provider, 'flightaware')
  assert.equal(facts.actualDepartureUTC, row.actual_out)
  assert.equal(facts.takeoffUTC, row.actual_off)
  assert.equal(facts.touchdownUTC, row.actual_on)
  assert.equal(facts.actualArrivalUTC, row.actual_in)
  assert.equal(facts.aircraftCode, 'C919')
  assert.equal(facts.aircraft, undefined)
  assert.deepEqual(validateWorkerFacts(facts, request, now), JSON.parse(JSON.stringify(facts)))
  assert.throws(() => validateWorkerFacts({ ...facts, actualArrivalUTC: '2026-10-12T03:00:00Z' }, request, now))
})

test('FlightAware skips estimates, cancelled/diverted flights and ambiguous same-day legs', () => {
  for (const changed of [{ actual_on: null, estimated_on: row.actual_on }, { cancelled: true }, { diverted: true }, { actual_off: row.actual_in }, { actual_in: '2026-10-14T00:00:00Z' }]) {
    assert.throws(() => parseFlightAware({ flights: [{ ...row, ...changed }] }, request, now), FlightSyncError)
  }
  const partial = parseFlightAware({ flights: [{ ...row, actual_in: null, actual_out: null }] }, request, now)
  assert.equal(partial.actualArrivalUTC, undefined)
  assert.equal(partial.actualDepartureUTC, undefined)
  assert.throws(() => parseFlightAware({ flights: [row, { ...row, fa_flight_id: 'another', actual_on: '2026-10-12T05:10:00Z', actual_in: null }] }, request, now), /多个航段/)
})

test('provider selection rejects unknown sources and missing FlightAware key without making paid calls', async () => {
  const original = process.env.FLIGHT_DATA_PROVIDER, originalKey = process.env.FLIGHTAWARE_API_KEY
  try {
    process.env.FLIGHT_DATA_PROVIDER = 'unknown'
    await assert.rejects(lookupFlight(request), /配置无效/)
    process.env.FLIGHT_DATA_PROVIDER = 'flightaware'; delete process.env.FLIGHTAWARE_API_KEY
    await assert.rejects(lookupFlight(request), /未配置/)
  } finally {
    if (original == null) delete process.env.FLIGHT_DATA_PROVIDER; else process.env.FLIGHT_DATA_PROVIDER = original
    if (originalKey == null) delete process.env.FLIGHTAWARE_API_KEY; else process.env.FLIGHTAWARE_API_KEY = originalKey
  }
})
