'use client'

import { useEffect, useState } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import { Temporal } from '@js-temporal/polyfill'
import type { DateFieldClientProps, TextFieldClientProps } from 'payload'
import { airportMap } from '@/lib/flights/airports'
import { formatTimeInput, localToUTC } from '@/lib/flights/time'
import './admin-tools.css'

export function FlightTimeField({ path, field, readOnly }: DateFieldClientProps | TextFieldClientProps) {
  const planned = path === 'departureLocal' || path === 'arrivalLocal'
  const arrival = path === 'arrivalLocal' || path === 'touchdownUTC' || path === 'actualArrivalUTC'
  const code = useFormFields(([fields]) => String(arrival ? fields.divertedTo?.value || fields.to?.value || '' : fields.from?.value || '').trim().toUpperCase())
  const flightDate = useFormFields(([fields]) => String(fields.date?.value || ''))
  const zone = airportMap.get(code)?.timeZone
  const { value, setValue, showError, errorMessage, disabled } = useField<string | null>({ path, validate: value => {
    if (!value) return true
    try { if (planned) localToUTC(value, zone!); else Temporal.Instant.from(value); return true }
    catch { return '请填写有效日期和 24 小时时间；夏令时歧义需要核对。' }
  } })
  let local = ''
  if (value && zone) {
    try { local = planned ? value : Temporal.Instant.from(value).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' }) }
    catch { local = value }
  }
  const [date, setDate] = useState(local.slice(0, 10) || flightDate)
  const [time, setTime] = useState(local.slice(11, 16))
  useEffect(() => { setDate(local.slice(0, 10) || flightDate); setTime(local.slice(11, 16)) }, [local, flightDate])
  const id = `flight-time-${path}`
  const locked = !zone || disabled || readOnly
  function save(nextDate: string, nextTime: string) {
    if (!nextTime && !value) return
    // Display minutes without truncating an unchanged imported/radar timestamp.
    if (nextDate === local.slice(0, 10) && nextTime === local.slice(11, 16)) return
    const entered = `${nextDate}T${nextTime}`
    let next = entered
    try { const utc = localToUTC(entered, zone!); next = planned ? entered : utc } catch { /* Keep invalid values visible so validation prevents saving. */ }
    if (next !== value) setValue(next)
  }
  return <div className="field-type flight-time-field">
    <label className="field-label" htmlFor={`${id}-time`}>{typeof field.label === 'string' ? field.label : path}</label>
    <div className="flight-time-inputs">
      <input aria-label={`${typeof field.label === 'string' ? field.label : path}日期`} type="date" value={date} disabled={locked}
        onChange={event => { setDate(event.currentTarget.value); if (time) save(event.currentTarget.value, time) }} />
      <input id={`${id}-time`} type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} value={time} disabled={locked} aria-invalid={showError} aria-describedby={`${id}-help`}
        onChange={event => setTime(formatTimeInput(event.currentTarget.value))} onBlur={() => save(date, time)} />
      <button type="button" className="flight-time-clear" disabled={locked || (!value && !time)} onClick={() => { setValue(null); setTime('') }}>清空</button>
    </div>
    <p id={`${id}-help`} className="field-description">{zone ? `${code} · ${zone} · 24 小时制，输入 1711 即为 17:11。${!value ? '尚未记录。' : ''}` : '先填写有效机场代码，再录入当地时间。'}</p>
    {showError && <p className="admin-tool-error" role="alert">{errorMessage}</p>}
  </div>
}
