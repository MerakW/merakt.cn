import { test } from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import { previewFlightyCSV } from '../src/lib/flights/import-flighty'
import { previewFlightyBackfill } from '../src/lib/flights/backfill-flighty'
import { airportMap } from '../src/lib/flights/airports'

const row = { Date: '2026-10-12', From: 'HGH', To: 'HND', Flight: 'QA101', 'Gate Departure (Actual)': '2026-10-12T09:00', 'Take off (Actual)': '2026-10-12T09:10', 'Landing (Actual)': '2026-10-12T12:00', 'Gate Arrival (Actual)': '2026-10-12T12:10' }
const imported = () => previewFlightyCSV(Papa.unparse([row]), airportMap).flights[0]

test('real Flighty Take off header imports all four airport-local actual times', () => {
  const flight = imported()
  assert.equal(flight.actualDepartureUTC, '2026-10-12T01:00:00Z')
  assert.equal(flight.takeoffUTC, '2026-10-12T01:10:00Z')
  assert.equal(flight.touchdownUTC, '2026-10-12T03:00:00Z')
  assert.equal(flight.actualArrivalUTC, '2026-10-12T03:10:00Z')
})

test('backfill preserves manual times and privacy, only fills missing fields, rerun is empty', () => {
  const flight = { ...imported(), id: 7, visibility: 'public' as const, note: '保留', takeoffUTC: undefined, touchdownUTC: undefined, actualArrivalUTC: '2026-10-12T03:15:00Z' }
  const preview = previewFlightyBackfill([flight], airportMap)
  assert.equal(preview.updates.length, 1)
  assert.deepEqual(preview.updates[0].data, { takeoffUTC: '2026-10-12T01:10:00Z', touchdownUTC: '2026-10-12T03:00:00Z' })
  assert.equal(previewFlightyBackfill([{ ...flight, ...preview.updates[0].data }], airportMap).updates.length, 0)
})

test('backfill skips chronology conflicts, changed routes, cancellations and absent sources', () => {
  const base = { ...imported(), id: 7, takeoffUTC: undefined }
  const preview = previewFlightyBackfill([
    { ...base, touchdownUTC: '2026-10-12T01:05:00Z' },
    { ...base, id: 8, from: 'SHA' },
    { ...base, id: 9, state: 'cancelled' },
    { ...base, id: 10, privateDetails: undefined },
  ], airportMap)
  assert.equal(preview.updates.length, 0)
  assert.equal(preview.issues.length, 2)
})
