import Papa from 'papaparse'
import { createHash } from 'node:crypto'
import { validDate, localToUTC } from './time'
import type { Airport, FlightRecord, ImportPreview } from './types'

const REQUIRED = ['Date', 'From', 'To']

export function previewFlightyCSV(csv: string, airports: Map<string, Airport>, options: {
  now?: Date
  existing?: FlightRecord[]
} = {}): ImportPreview {
  const result: ImportPreview = { totalRows: 0, flights: [], duplicates: [], issues: [], valid: false }
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
    transform: value => value.trim(),
  })
  result.totalRows = parsed.data.length
  for (const error of parsed.errors) result.issues.push({
    row: (error.row ?? 0) + 2, code: 'csv-format', severity: 'error', message: error.message,
  })
  for (const field of REQUIRED) if (!parsed.meta.fields?.includes(field)) {
    result.issues.push({ row: 1, field, severity: 'error', code: 'missing-column', message: `缺少必需列：${field}` })
  }
  if (result.issues.some(issue => issue.row === 1)) return result

  const seen = new Map<string, { row?: number; signature: string }>()
  const signature = (record: Record<string, string>) => JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]))
  for (const flight of options.existing ?? []) {
    seen.set(flight.importKey, { signature: flight.privateDetails?.sourceRow ? signature(flight.privateDetails.sourceRow) : '' })
  }
  const now = options.now ?? new Date()

  parsed.data.forEach((row, index) => {
    const line = index + 2
    const issue = (field: string, code: string, message: string, severity: 'error' | 'warning' = 'error') => {
      result.issues.push({ row: line, field, code, message, severity })
    }
    if (!validDate(row.Date ?? '')) issue('Date', 'invalid-date', '日期不是有效的 YYYY-MM-DD')
    for (const field of ['From', 'To']) {
      if (!/^[A-Z]{3}$/.test(row[field] ?? '')) issue(field, 'invalid-airport', '机场应使用三位大写 IATA 代码')
      else if (!airports.has(row[field])) issue(field, 'unknown-airport', `未找到机场 ${row[field]}，请补充机场位置和时区`)
    }
    if (row.From && row.From === row.To) issue('To', 'same-airport', '出发与到达机场相同，请确认是否为特殊航程', 'warning')
    if (row.Canceled && !['true', 'false'].includes(row.Canceled.toLowerCase())) {
      issue('Canceled', 'invalid-cancelled', '取消标记必须为 true 或 false')
    }
    if (row['Diverted To'] && !airports.has(row['Diverted To'])) issue('Diverted To', 'unknown-airport', '备降机场未收录')

    const from = airports.get(row.From)
    const to = airports.get(row.To)
    const convert = (field: string, airport: Airport | undefined) => {
      if (!row[field] || !airport) return undefined
      try { return localToUTC(row[field], airport.timeZone) } catch {
        issue(field, 'invalid-local-time', '本地时间无效或位于夏令时歧义区间，请核实后修正')
        return undefined
      }
    }
    const departureUTC = convert('Gate Departure (Scheduled)', from)
    const arrivalUTC = convert('Gate Arrival (Scheduled)', to)
    const actualDepartureUTC = convert('Gate Departure (Actual)', from)
    // Flighty may export a destination-local arrival for a diverted flight. Require review
    // if the two airports use different zones; never silently guess an actual arrival zone.
    const diverted = row['Diverted To'] ? airports.get(row['Diverted To']) : undefined
    if (diverted && to && diverted.timeZone !== to.timeZone && row['Gate Arrival (Actual)']) {
      issue('Gate Arrival (Actual)', 'diversion-timezone', '备降机场时区不同，请确认实际到达时间使用哪个机场时区')
    }
    const actualArrivalUTC = convert('Gate Arrival (Actual)', diverted ?? to)
    const landingUTC = convert('Landing (Actual)', diverted ?? to)
    if (departureUTC && arrivalUTC && Date.parse(arrivalUTC) <= Date.parse(departureUTC)) {
      issue('Gate Arrival (Scheduled)', 'arrival-before-departure', '计划到达必须晚于计划出发，请检查日期和时区')
    }
    if (actualDepartureUTC && actualArrivalUTC && Date.parse(actualArrivalUTC) <= Date.parse(actualDepartureUTC)) {
      issue('Gate Arrival (Actual)', 'arrival-before-departure', '实际到达必须晚于实际出发，请检查日期和时区')
    }
    const cancelled = row.Canceled?.toLowerCase() === 'true'
    let state: FlightRecord['state'] = 'unconfirmed'
    if (cancelled) state = 'cancelled'
    else if (actualArrivalUTC || landingUTC) state = 'completed'
    else if (departureUTC && Date.parse(departureUTC) > now.getTime()) state = 'planned'
    else issue('Gate Arrival (Actual)', 'completion-unconfirmed', '缺少实际到达记录，保留为待确认，不自动标记已完成', 'warning')

    const sourceId = row['Flight Flighty ID'] || undefined
    const identity = [row.Date, row.Airline, row.Flight, row.From, row.To, row['Gate Departure (Scheduled)']].join('|')
    const importKey = sourceId ? `flighty:${sourceId}` : `route:${createHash('sha256').update(identity).digest('hex').slice(0, 32)}`
    const rowSignature = signature(row)
    const prior = seen.get(importKey)
    if (prior) {
      if (prior.signature === rowSignature) result.duplicates.push({ row: line, firstRow: prior.row, importKey })
      else issue('Flight Flighty ID', 'conflicting-duplicate', '相同记录标识存在不同数据，需要选择保留或更新，不能直接覆盖')
      return
    }
    seen.set(importKey, { row: line, signature: rowSignature })
    if (result.issues.some(item => item.row === line && item.severity === 'error')) return

    result.flights.push({
      importKey, sourceId,
      date: row.Date, airline: row.Airline || undefined, flightNumber: row.Flight || undefined,
      from: row.From, to: row.To, divertedTo: row['Diverted To'] || undefined,
      state, visibility: 'private',
      departureLocal: row['Gate Departure (Scheduled)'] || undefined,
      arrivalLocal: row['Gate Arrival (Scheduled)'] || undefined,
      departureUTC, arrivalUTC, actualDepartureUTC, actualArrivalUTC,
      departureTimeZone: from?.timeZone, arrivalTimeZone: to?.timeZone,
      aircraft: row['Aircraft Type Name'] || undefined, registration: row['Tail Number'] || undefined,
      // Source notes remain private until the owner chooses public copy.
      privateDetails: {
        pnr: row.PNR || undefined, seat: row.Seat || undefined, seatType: row['Seat Type'] || undefined,
        cabinClass: row['Cabin Class'] || undefined, reason: row['Flight Reason'] || undefined,
        sourceRow: row,
      },
    })
  })
  result.valid = result.totalRows > 0 && !result.issues.some(issue => issue.severity === 'error')
  return result
}
