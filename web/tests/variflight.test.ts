import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVariFlight, validateProviderFlights } from '../src/lib/flights/variflight'
const now = new Date('2026-10-20T00:00:00Z')
const request = { flight_number: 'QA101', date: '2026-10-11' }
const row = { FlightNo: 'QA101', FlightDepcode: 'HGH', FlightArrcode: 'HND', FlightState: '到达', FlightDeptimePlanDate: '2026-10-11 09:00:00', FlightArrtimePlanDate: '2026-10-11 12:00:00', FlightOutgateTime: '2026-10-11 09:05:00', FlightDeptimeDate: '2026-10-11 09:15:00', FlightArrtimeDate: '2026-10-11 12:10:00', FlightIngateTime: '', FlightArrtimeReadyDate: '2026-10-11 12:20:00', AircraftNumber: 'TEST-101', ftype: 'A320', generic: 'Test model', org_timezone: '28800', dst_timezone: '32400' }
test('VariFlight distinguishes gate, runway and estimated timestamps in airport timezones', () => {
  const result = parseVariFlight({ code: 200, data: [row] }, request, now)
  assert.equal(result.length, 1)
  assert.equal(result[0].actualDepartureUTC, '2026-10-11T01:05:00Z')
  assert.equal(result[0].takeoffUTC, '2026-10-11T01:15:00Z')
  assert.equal(result[0].touchdownUTC, '2026-10-11T03:10:00Z')
  assert.equal(result[0].actualArrivalUTC, undefined)
  assert.equal(validateProviderFlights(result, request, now)[0].registration, 'TEST-101')
})
test('VariFlight rejects wrong identity, dates, cancellations, inconsistent clocks and source zones', () => {
  const rows = [{ ...row, FlightNo: 'QA102' }, { ...row, FlightNo: 123 }, { ...row, FlightDeptimePlanDate: '2026-10-12 09:00:00' }, { ...row, FlightState: '取消' }, { ...row, FlightIngateTime: '2026-10-11 11:00:00' }, { ...row, dst_timezone: '0' }]
  assert.deepEqual(parseVariFlight({ code: 200, data: rows }, request, now), [])
  assert.throws(() => parseVariFlight({ code: 403, data: [] }, request, now))
})
test('VariFlight preserves multiple legs without selecting a different flight or overwriting fields', () => {
  assert.equal(parseVariFlight({ code: 200, data: [row, { ...row, FlightOutgateTime: '2026-10-11 09:06:00' }] }, request, now).length, 2)
  assert.throws(() => validateProviderFlights([{ ...parseVariFlight({ code: 200, data: [row] }, request, now)[0], date: '2026-10-12' }], request, now))
  const result = validateProviderFlights([{ ...parseVariFlight({ code: 200, data: [row] }, request, now)[0], visibility: 'public', note: 'injected' }], request, now)[0]
  assert.equal('visibility' in result, false)
  assert.equal('note' in result, false)
})
