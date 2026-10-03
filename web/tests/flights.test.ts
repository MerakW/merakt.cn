import { test } from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { previewFlightyCSV } from '../src/lib/flights/import-flighty'
import { selectFeaturedFlight, isFlightPublic, publicFlight } from '../src/lib/flights/public'
import { localToUTC, arrivalDayOffset, validDate } from '../src/lib/flights/time'
import type { Airport, FlightRecord } from '../src/lib/flights/types'

const airports = new Map<string, Airport>([
  ['HGH', { iata: 'HGH', city: '杭州', name: '杭州萧山', country: 'CN', timeZone: 'Asia/Shanghai', latitude: 30.2295, longitude: 120.434 }],
  ['HND', { iata: 'HND', city: '东京', name: '东京羽田', country: 'JP', timeZone: 'Asia/Tokyo', latitude: 35.5523, longitude: 139.78 }],
  ['LHR', { iata: 'LHR', city: 'London', name: 'Heathrow', country: 'GB', timeZone: 'Europe/London', latitude: 51.47, longitude: -0.454 }],
])
const now = new Date('2026-09-29T06:00:00Z')
const base = {
  Date: '2026-09-20', Airline: 'TEST', Flight: '001', From: 'HGH', To: 'HND', Canceled: 'false',
  'Gate Departure (Scheduled)': '2026-09-20T09:00', 'Gate Arrival (Scheduled)': '2026-09-20T13:00',
  'Gate Departure (Actual)': '2026-09-20T09:05', 'Gate Arrival (Actual)': '2026-09-20T13:05',
  'Flight Flighty ID': 'synthetic-only', PNR: 'PRIVATE-EXAMPLE', Seat: '1A', Notes: 'private note',
}
const preview = (rows: Record<string, string>[]) => previewFlightyCSV(Papa.unparse(rows), airports, { now })
const flight = (overrides: Partial<FlightRecord> = {}): FlightRecord => ({
  importKey: 'test', id: 'test', date: '2026-09-20', from: 'HGH', to: 'HND', state: 'completed',
  visibility: 'public', departureTimeZone: 'Asia/Shanghai', ...overrides,
})

test('Flighty wall times are converted using each airport timezone, not server timezone', () => {
  const result = preview([base]); assert.equal(result.valid, true)
  assert.equal(result.flights[0].departureUTC, '2026-09-20T01:00:00Z')
  assert.equal(result.flights[0].arrivalUTC, '2026-09-20T04:00:00Z')
  assert.equal(result.flights[0].state, 'completed')
  assert.equal(result.flights[0].visibility, 'private')
})
test('exact duplicate is skipped and identifies first source row', () => {
  const result = preview([base, base])
  assert.equal(result.flights.length, 1); assert.deepEqual(result.duplicates.map(d => [d.row, d.firstRow]), [[3, 2]])
})
test('same Flighty ID with conflicting values requires review instead of overwrite', () => {
  const result = preview([base, { ...base, Seat: '9C' }])
  assert.equal(result.valid, false); assert.ok(result.issues.some(i => i.code === 'conflicting-duplicate'))
})
test('existing unchanged import is idempotent', () => {
  const first = preview([base])
  const again = previewFlightyCSV(Papa.unparse([base]), airports, { now, existing: first.flights })
  assert.equal(again.flights.length, 0); assert.equal(again.duplicates.length, 1); assert.equal(again.valid, true)
})
test('CSV parser preserves quoted commas, newlines and BOM', () => {
  const notes = 'two places, one trip\nsecond line "quoted"'
  const result = previewFlightyCSV('\uFEFF' + Papa.unparse([{ ...base, Notes: notes }]), airports, { now })
  assert.equal(result.valid, true); assert.equal(result.flights[0].privateDetails?.sourceRow?.Notes, notes)
})
test('missing columns and malformed CSV fail preview', () => {
  assert.equal(previewFlightyCSV('Date,From\n2026-01-01,HGH', airports).valid, false)
  assert.equal(previewFlightyCSV('Date,From,To\n"2026-01-01,HGH,HND', airports).valid, false)
})
test('unknown airport never guesses a timezone', () => {
  const result = preview([{ ...base, To: 'ZZZ' }])
  assert.equal(result.valid, false); assert.equal(result.flights.length, 0)
  assert.ok(result.issues.some(i => i.code === 'unknown-airport'))
})
test('missing actual arrival stays unconfirmed even if planned arrival is in the past', () => {
  const result = preview([{ ...base, 'Gate Arrival (Actual)': '' }])
  assert.equal(result.flights[0].state, 'unconfirmed')
})
test('cancelled export is never marked completed', () => {
  assert.equal(preview([{ ...base, Canceled: 'true' }]).flights[0].state, 'cancelled')
})
test('fallback identity keeps different departures of same route distinct', () => {
  const first = { ...base, 'Flight Flighty ID': '' }
  const second = { ...first, 'Gate Departure (Scheduled)': '2026-09-20T10:00' }
  assert.equal(preview([first, second]).flights.length, 2)
})
test('impossible dates and arrival before departure are rejected', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2024-02-29'), true)
  assert.equal(preview([{ ...base, 'Gate Arrival (Scheduled)': '2026-09-20T09:30' }]).valid, false)
})
test('cross-day arrival offset is based on local calendar dates', () => {
  assert.equal(arrivalDayOffset('2026-12-31', '2027-01-01T05:00'), 1)
  assert.equal(arrivalDayOffset('2026-01-02', '2026-01-01T20:00'), -1)
})
test('DST gaps and overlaps are flagged, while ordinary summer/winter conversion is correct', () => {
  assert.throws(() => localToUTC('2026-03-29T01:30', 'Europe/London'))
  assert.throws(() => localToUTC('2026-10-25T01:30', 'Europe/London'))
  assert.equal(localToUTC('2026-07-01T12:00', 'Europe/London'), '2026-07-01T11:00:00Z')
  assert.equal(localToUTC('2026-01-01T12:00', 'Europe/London'), '2026-01-01T12:00:00Z')
})
test('public output uses an allowlist and strips booking and import details', () => {
  const out = publicFlight(preview([base]).flights[0])
  assert.equal('privateDetails' in out, false); assert.equal('sourceId' in out, false); assert.equal('importKey' in out, false)
  assert.ok(!JSON.stringify(out).includes('PRIVATE-EXAMPLE'))
})
test('scheduled publication is evaluated at the boundary and invalid date fails closed', () => {
  assert.equal(isFlightPublic(flight({ visibility: 'scheduled', publishAt: now.toISOString() }), now), true)
  assert.equal(isFlightPublic(flight({ visibility: 'scheduled', publishAt: 'bad' }), now), false)
  assert.equal(isFlightPublic(flight({ visibility: 'private' }), now), false)
})
test('featured flight chooses nearest public future plan, excluding private and cancelled', () => {
  const selected = selectFeaturedFlight([
    flight({ id: 'history' }),
    flight({ id: 'far', state: 'planned', date: '2026-10-05', departureUTC: '2026-10-05T01:00:00Z' }),
    flight({ id: 'near', state: 'planned', date: '2026-10-01', departureUTC: '2026-10-01T01:00:00Z' }),
    flight({ id: 'private', state: 'planned', visibility: 'private', date: '2026-09-30', departureUTC: '2026-09-30T01:00:00Z' }),
    flight({ id: 'cancelled', state: 'cancelled', date: '2026-09-30', departureUTC: '2026-09-30T01:00:00Z' }),
  ], now)
  assert.equal(selected?.kind, 'upcoming'); assert.equal(selected?.flight.id, 'near')
})
test('latest completed is fallback, never an expired plan or unconfirmed record', () => {
  const selected = selectFeaturedFlight([
    flight({ id: 'latest', date: '2026-09-20' }),
    flight({ id: 'old', date: '2025-12-31' }),
    flight({ id: 'unknown', date: '2026-09-25', state: 'unconfirmed' }),
    flight({ id: 'expired', date: '2026-09-28', state: 'planned' }),
  ], now)
  assert.equal(selected?.flight.id, 'latest'); assert.equal(selected?.kind, 'latest')
  assert.equal(selectFeaturedFlight([], now), null)
})
test('date-only plan stays upcoming on its local day without inventing a takeoff time', () => {
  const selected = selectFeaturedFlight([flight({ state: 'planned', date: '2026-09-29' })], now)
  assert.equal(selected?.kind, 'upcoming'); assert.equal(selected?.flight.departureUTC, undefined)
})

test('planned schedule privacy removes every timestamp before serialization and preserves upcoming selection', () => {
  const planned = flight({state:'planned',hideSchedule:true,date:'2099-12-31',departureLocal:'2099-12-31T09:30',arrivalLocal:'2099-12-31T13:00',departureUTC:'2099-12-31T01:30:00.000Z',arrivalUTC:'2099-12-31T04:00:00.000Z',actualDepartureUTC:'2099-12-31T01:31:00.000Z',note:'Meet 2099-12-31'})
  const out=publicFlight(planned)
  assert.equal(out.dateHidden,true)
  assert.equal(out.departureClock,'09:30')
  assert.equal(out.arrivalClock,'13:00')
  assert.equal(out.departureLocal,undefined)
  assert.equal(out.departureUTC,undefined)
  assert.equal(out.date,'2099-**-**')
  assert.ok(!JSON.stringify(out).includes('2099-12-31'))
  assert.equal(selectFeaturedFlight([planned],now)?.kind,'upcoming')
  assert.equal(selectFeaturedFlight([planned],now)?.flight.dateHidden,true)
  assert.equal(publicFlight({...planned,hideSchedule:false}).date,'2099-12-31')
  assert.equal(publicFlight({...planned,state:'completed'}).date,'2099-12-31')
})
