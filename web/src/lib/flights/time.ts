import { Temporal } from '@js-temporal/polyfill'

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  try { return Temporal.PlainDate.from(value, { overflow: 'reject' }).toString() === value } catch { return false }
}

/** Flighty exports local wall times without offsets. Ambiguous DST times need review. */
export function localToUTC(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new Error('时间格式应为 YYYY-MM-DDTHH:mm')
  }
  const local = Temporal.PlainDateTime.from(value, { overflow: 'reject' })
  return local.toZonedDateTime(timeZone, { disambiguation: 'reject' }).toInstant().toString()
}

export function localDayStartUTC(date: string, timeZone: string): string {
  // Some zones historically skipped midnight. startOfDay returns the first real instant.
  return Temporal.PlainDate.from(date).toZonedDateTime(timeZone).startOfDay().toInstant().toString()
}

export function arrivalDayOffset(departureDate: string, arrivalLocal: string): number {
  return Temporal.PlainDate.from(departureDate).until(Temporal.PlainDate.from(arrivalLocal.slice(0, 10))).days
}
