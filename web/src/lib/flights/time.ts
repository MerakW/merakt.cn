import { Temporal } from '@js-temporal/polyfill'

export function formatTimeInput(value: string): string {
  const normalized = value.normalize('NFKC')
  if (normalized.includes(':')) {
    const [hour, minute = ''] = normalized.split(':')
    return `${hour.replace(/\D/g, '').slice(0, 2).padStart(2, '0')}:${minute.replace(/\D/g, '').slice(0, 2)}`
  }
  const digits = normalized.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

export function validateActualTimes(doc: Record<string, unknown>): void {
  const fields = [['actualDepartureUTC', '出位'], ['takeoffUTC', '起飞'], ['touchdownUTC', '接地'], ['actualArrivalUTC', '入位']] as const
  let previous: { instant: Temporal.Instant; label: string } | undefined
  for (const [field, label] of fields) {
    const value = doc[field]
    if (value == null || value === '') continue
    let instant: Temporal.Instant
    try { instant = Temporal.Instant.from(String(value)) } catch { throw new Error(`实际${label}时间无效，请填写带时区的完整时间。`) }
    if (previous && Temporal.Instant.compare(instant, previous.instant) < 0) {
      throw new Error(`实际${label}时间不能早于实际${previous.label}时间，请核对日期和机场时区。`)
    }
    previous = { instant, label }
  }
}

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
