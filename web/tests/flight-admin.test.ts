import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTimeInput, localToUTC, validateActualTimes } from '../src/lib/flights/time'
import { publicFlight } from '../src/lib/flights/public'
import { previewFlightyCSV } from '../src/lib/flights/import-flighty'
import { airportMap } from '../src/lib/flights/airports'
import Papa from 'papaparse'

test('minute input adds colon while typing and accepts pasted/full-width times', () => {
  assert.deepEqual(['', '1', '17', '171', '1711'].map(formatTimeInput), ['', '1', '17', '17:1', '17:11'])
  assert.equal(formatTimeInput('17:11'), '17:11')
  assert.equal(formatTimeInput('１７：１１'), '17:11')
  assert.equal(formatTimeInput('9:05'), '09:05')
  assert.equal(formatTimeInput('2460'), '24:60')
  assert.throws(() => localToUTC(`2026-10-13T${formatTimeInput('2460')}`, 'Asia/Shanghai'))
})

test('actual times accept missing fields, equal minute precision, cross-day and different offsets', () => {
  validateActualTimes({ actualDepartureUTC: '2026-10-12T23:50:00+08:00', takeoffUTC: '2026-10-12T23:50:00+08:00', touchdownUTC: '2026-10-13T01:20:00+09:00', actualArrivalUTC: '2026-10-13T01:30:00+09:00' })
  validateActualTimes({ touchdownUTC: '2026-10-13T01:20:00+08:00' })
  assert.throws(() => validateActualTimes({ touchdownUTC: '2026-10-13T01:20:00+08:00', actualArrivalUTC: '2026-10-13T01:10:00+08:00' }), /入位.*接地/)
  assert.throws(() => validateActualTimes({ actualDepartureUTC: '2026-10-12T12:00:00Z', actualArrivalUTC: '2026-10-12T11:00:00Z' }), /入位.*出位/)
  assert.throws(() => validateActualTimes({ takeoffUTC: '2026-10-12T09:00' }), /时区/)
  assert.equal(localToUTC('2026-10-12T09:00:23', 'Asia/Shanghai'), '2026-10-12T01:00:23Z')
})

test('Flighty runway times survive import and remain hidden for private future schedules', () => {
  const result = previewFlightyCSV(Papa.unparse([{ Date: '2026-10-12', From: 'HGH', To: 'HND', 'Takeoff (Actual)': '2026-10-12T09:00', 'Landing (Actual)': '2026-10-12T12:00' }]), airportMap)
  assert.equal(result.valid, true)
  const flight = result.flights[0]
  assert.equal(flight.takeoffUTC, '2026-10-12T01:00:00Z')
  assert.equal(flight.touchdownUTC, '2026-10-12T03:00:00Z')
  const hidden = publicFlight({ ...flight, state: 'planned', hideSchedule: true })
  assert.equal(hidden.takeoffUTC, undefined)
  assert.equal(hidden.touchdownUTC, undefined)
})
