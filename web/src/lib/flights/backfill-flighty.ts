import Papa from 'papaparse'
import { previewFlightyCSV } from './import-flighty'
import { validateActualTimes } from './time'
import type { Airport, FlightRecord } from './types'

const actualFields = ['actualDepartureUTC', 'takeoffUTC', 'touchdownUTC', 'actualArrivalUTC'] as const
type ActualTimes = Partial<Pick<FlightRecord, typeof actualFields[number]>>
export const actualTimeLabels = { actualDepartureUTC: '出位', takeoffUTC: '起飞', touchdownUTC: '接地', actualArrivalUTC: '入位' }

/** Recover only missing facts from each record's saved CSV row; never overwrite edits. */
export function previewFlightyBackfill(flights: FlightRecord[], airports: Map<string, Airport>) {
  const updates: { id: number | string; date: string; flightNumber?: string; from: string; to: string; data: ActualTimes }[] = []
  const issues: { id: number | string; message: string }[] = []
  let withSource = 0
  for (const flight of flights) {
    const row = flight.privateDetails?.sourceRow
    if (!row || flight.id == null) continue
    withSource++
    if (flight.state === 'cancelled' || actualFields.every(field => flight[field])) continue
    const preview = previewFlightyCSV(Papa.unparse([row]), airports)
    const parsed = preview.flights[0]
    if (!preview.valid || !parsed) {
      issues.push({ id: flight.id, message: preview.issues.filter(issue => issue.severity === 'error').map(issue => issue.message).join('；') || '原始行无法解析。' })
      continue
    }
    if (parsed.date !== flight.date || parsed.from !== flight.from || parsed.to !== flight.to || (parsed.divertedTo || '') !== (flight.divertedTo || '')) {
      issues.push({ id: flight.id, message: '航段日期或机场已修改，请手动核对原始记录。' })
      continue
    }
    const data: ActualTimes = {}
    for (const field of actualFields) if (!flight[field] && parsed[field]) data[field] = parsed[field]
    if (!Object.keys(data).length) continue
    try { validateActualTimes({ ...flight, ...data }) }
    catch (error) { issues.push({ id: flight.id, message: (error as Error).message }); continue }
    updates.push({ id: flight.id, date: flight.date, flightNumber: flight.flightNumber, from: flight.from, to: flight.to, data })
  }
  return { total: flights.length, withSource, updates, issues }
}
