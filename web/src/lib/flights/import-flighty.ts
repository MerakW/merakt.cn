import Papa from 'papaparse'
import { createHash } from 'node:crypto'
import { validDate, localToUTC } from './time'
import type { Airport, FlightRecord, ImportPreview } from './types'

const REQUIRED = ['Date', 'From', 'To']

export function previewFlightyCSV(csv: string, airports: Map<string, Airport>, options: {
  now?: Date
  existing?: FlightRecord[]
} = {}): ImportPreview {
  const result: ImportPreview = { totalRows: 0, flights: [], updates: [], duplicates: [], issues: [], valid: false }
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

  const seen = new Map<string, { row?: number; signature: string; flight: FlightRecord }>()
  const signature = (record: Record<string, string>) => JSON.stringify(Object.keys(record).sort().map(key => [key, record[key]]))
  for (const flight of options.existing ?? []) {
    seen.set(flight.importKey, { signature: flight.privateDetails?.sourceRow ? signature(flight.privateDetails.sourceRow) : '', flight })
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
        issue(field, 'invalid-local-time', '时间无法确认，暂不采用；原值保留在导入信息中。', 'warning')
        return undefined
      }
    }
    let departureUTC = convert('Gate Departure (Scheduled)', from)
    let arrivalUTC = convert('Gate Arrival (Scheduled)', to)
    let actualDepartureUTC = convert('Gate Departure (Actual)', from)
    const diverted = row['Diverted To'] ? airports.get(row['Diverted To']) : undefined
    if (diverted && to && diverted.timeZone !== to.timeZone && (row['Gate Arrival (Actual)'] || row['Landing (Actual)'])) {
      issue('Gate Arrival (Actual)', 'diversion-timezone', '已按备降机场时区换算，原始到达时间的时区需要核对。', 'warning')
    }
    const actualArrivalUTC = convert('Gate Arrival (Actual)', diverted ?? to)
    let takeoffUTC = convert(row['Take off (Actual)'] ? 'Take off (Actual)' : 'Takeoff (Actual)', from)
    let landingUTC = convert('Landing (Actual)', diverted ?? to)
    let next = actualArrivalUTC
    const keepEarlier = (value: string | undefined, field: string) => {
      if (value && next && Date.parse(value) > Date.parse(next)) {
        issue(field, 'invalid-actual-order', '实际时间顺序冲突，优先保留实际入位及后续有效节点；此值仅保存在原始记录中。', 'warning')
        return undefined
      }
      if (value) next = value
      return value
    }
    landingUTC = keepEarlier(landingUTC, 'Landing (Actual)')
    takeoffUTC = keepEarlier(takeoffUTC, 'Take off (Actual)')
    actualDepartureUTC = keepEarlier(actualDepartureUTC, 'Gate Departure (Actual)')
    if (departureUTC && arrivalUTC && Date.parse(arrivalUTC) <= Date.parse(departureUTC)) {
      issue('Gate Arrival (Scheduled)', 'arrival-before-departure', '计划时间顺序冲突，暂不采用计划入位时间；实际入位不受影响。', 'warning')
      arrivalUTC = undefined
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
    if (result.issues.some(item => item.row === line && item.severity === 'error')) return
    const flight: FlightRecord = {
      importKey, sourceId,
      date: row.Date, airline: row.Airline || undefined, flightNumber: row.Flight || undefined,
      from: row.From, to: row.To, divertedTo: row['Diverted To'] || undefined,
      state, visibility: 'private',
      departureLocal: departureUTC ? row['Gate Departure (Scheduled)'] : undefined,
      arrivalLocal: arrivalUTC ? row['Gate Arrival (Scheduled)'] : undefined,
      departureUTC, arrivalUTC, actualDepartureUTC, actualArrivalUTC, takeoffUTC, touchdownUTC: landingUTC,
      departureTimeZone: from?.timeZone, arrivalTimeZone: to?.timeZone,
      aircraft: row['Aircraft Type Name'] || undefined, registration: row['Tail Number'] || undefined,
      // Source notes remain private until the owner chooses public copy.
      privateDetails: {
        pnr: row.PNR || undefined, seat: row.Seat || undefined, seatType: row['Seat Type'] || undefined,
        cabinClass: row['Cabin Class'] || undefined, reason: row['Flight Reason'] || undefined,
        sourceRow: row,
        importIssues: result.issues.filter(item => item.row === line),
      },
    }
    const prior = seen.get(importKey)
    if (prior && (prior.signature === rowSignature || prior.flight.privateDetails?.conflictingRows?.some(item => signature(item) === rowSignature))) {
      result.duplicates.push({ row: line, firstRow: prior.row, importKey })
      return
    }
    if (prior) {
      issue('Flight Flighty ID', 'conflicting-duplicate', '同一航段数据不同：优先采用包含实际入位的记录；双方原始数据保留供核对。', 'warning')
      const selected = flight.actualArrivalUTC ? flight : prior.flight
      const merged: FlightRecord = { ...selected, id: prior.flight.id, privateDetails: {
        ...selected.privateDetails,
        importIssues: [...(prior.flight.privateDetails?.importIssues || []), ...result.issues.filter(item => item.row === line)],
        conflictingRows: [...(prior.flight.privateDetails?.conflictingRows || []), ...(selected === flight && prior.flight.privateDetails?.sourceRow ? [prior.flight.privateDetails.sourceRow] : [row])],
      } }
      if (selected === flight && prior.flight.date === flight.date && prior.flight.from === flight.from && prior.flight.to === flight.to && (prior.flight.divertedTo || '') === (flight.divertedTo || '')) {
        const fields = [['actualArrivalUTC', 'Gate Arrival (Actual)'], ['touchdownUTC', 'Landing (Actual)'], ['takeoffUTC', 'Take off (Actual)'], ['actualDepartureUTC', 'Gate Departure (Actual)']] as const
        let later: string | undefined
        for (const [field, source] of fields) {
          if (!row[source] && !(field === 'takeoffUTC' && row['Takeoff (Actual)'])) merged[field] ||= prior.flight[field]
          if (merged[field] && later && Date.parse(merged[field]!) > Date.parse(later)) {
            merged[field] = undefined
            issue(source, 'existing-time-conflict', '已有时间与本次实际入位冲突，原值保留在历史版本中。', 'warning')
          }
          if (merged[field]) later = merged[field]
        }
        for (const [field, source] of [['departureLocal', 'Gate Departure (Scheduled)'], ['arrivalLocal', 'Gate Arrival (Scheduled)']] as const) {
          if (!row[source]) merged[field] ||= prior.flight[field]
        }
        if (merged.departureLocal && merged.arrivalLocal) {
          try {
            if (Date.parse(localToUTC(merged.arrivalLocal, to!.timeZone)) <= Date.parse(localToUTC(merged.departureLocal, from!.timeZone))) {
              merged.arrivalLocal = undefined
              merged.arrivalUTC = undefined
              issue('Gate Arrival (Scheduled)', 'existing-schedule-conflict', '已有计划入位与本次计划出位冲突，暂不采用；实际入位不受影响。', 'warning')
            }
          } catch {
            merged.departureLocal = undefined; merged.arrivalLocal = undefined
            issue('Gate Arrival (Scheduled)', 'existing-schedule-invalid', '已有计划时间无效，暂不采用；原值保留在历史版本中。', 'warning')
          }
        }
        merged.privateDetails!.importIssues = [...(prior.flight.privateDetails?.importIssues || []), ...result.issues.filter(item => item.row === line)]
      }
      if (merged.id != null) {
        const position = result.updates.findIndex(item => item.id === merged.id)
        if (position >= 0) result.updates[position] = merged
        else result.updates.push(merged)
      } else {
        const position = result.flights.findIndex(item => item.importKey === importKey)
        result.flights[position] = merged
      }
      seen.set(importKey, { row: line, signature: rowSignature, flight: merged })
      return
    }
    seen.set(importKey, { row: line, signature: rowSignature, flight })
    result.flights.push(flight)
  })
  result.valid = result.totalRows > 0 && !result.issues.some(issue => issue.severity === 'error')
  return result
}
