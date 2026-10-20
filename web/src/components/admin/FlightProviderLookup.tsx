'use client'

import { useEffect, useState } from 'react'
import { useForm, useFormFields, useTranslation } from '@payloadcms/ui'
import { flightIdentity } from '@/lib/flights/airlines'
import { validateActualTimes } from '@/lib/flights/time'
import { airportMap } from '@/lib/flights/airports'
import { formatRegistration } from '@/lib/flights/registration'
import { translate, type MessageKey, type MessageValue } from '@/lib/i18n/core'
import type { ProviderFlight } from '@/lib/flights/variflight'
import './admin-tools.css'

type Ticket = { id: number; flightNumber: string; date: string; status: string; flights?: ProviderFlight[]; errorCode?: string; createdAt: string }
type Offer = { token: string; costFen: number; request: { flight_number: string; date: string }; existing: Ticket | null; limits: { day: number; month: number } }
async function requestQuery(body: unknown) {
  const response = await fetch('/api/flights/provider-query', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Query unavailable')
  return data
}
export function FlightProviderLookup() {
  const { i18n } = useTranslation()
  const en = i18n.language === 'en'
  const t = (key: MessageKey, values?: readonly MessageValue[]) => translate(key, en ? 'en' : 'zh-CN', values)
  const clock = (value: string | undefined, airport: string) => value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'zh-CN', { timeZone: airportMap.get(airport)?.timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—'
  const { getFields, dispatchFields, setModified } = useForm()
  const snapshot = useFormFields(([fields]) => JSON.stringify(['flightNumber', 'airline', 'date', 'from', 'to'].map(name => fields[name]?.value || '')))
  const [rawNumber, airline, date, from, to] = JSON.parse(snapshot) as string[]
  const identity = JSON.stringify([rawNumber, airline, date])
  const number = flightIdentity({ flightNumber: rawNumber, airline }).label
  const [offer, setOffer] = useState<Offer | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  useEffect(() => { setOffer(null); setTicket(null); setAcknowledged(false); setError(''); setMessage('') }, [identity])
  useEffect(() => { setOffer(null); setAcknowledged(false) }, [snapshot])
  useEffect(() => {
    if (!ticket || !['queued', 'running'].includes(ticket.status)) return
    const controller = new AbortController()
    let checking = false
    const interval = setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const result = await requestQuery({ action: 'status', id: ticket.id })
        if (!controller.signal.aborted) { setTicket(result); setError('') }
      } catch { if (!controller.signal.aborted) setError(t('paidFlight.progressError')) }
      finally { checking = false }
    }, 2500)
    return () => { controller.abort(); clearInterval(interval) }
  }, [ticket?.id, ticket?.status, en])
  async function prepare(refresh = false) {
    setBusy(true); setError(''); setMessage(''); setOffer(null); setAcknowledged(false)
    const original = snapshot
    try {
      const result = await requestQuery({ action: 'quote', flight_number: number, date, refresh })
      const current = getFields()
      const stillCurrent = JSON.stringify(['flightNumber', 'airline', 'date', 'from', 'to'].map(name => current[name]?.value || ''))
      if (stillCurrent !== original) return
      setOffer(result)
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  async function confirm() {
    if (!offer || !acknowledged) return
    setBusy(true); setError('')
    try {
      const result = await requestQuery({ action: 'confirm', token: offer.token })
      setTicket(result); setOffer(null); setAcknowledged(false)
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  function apply(flight: ProviderFlight) {
    try {
      const fields = getFields()
      const current = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]))
      if (flightIdentity({ flightNumber: String(current.flightNumber || ''), airline: String(current.airline || '') }).label !== flight.flightNumber || current.date !== flight.date ||
        (current.from && String(current.from).toUpperCase() !== flight.from) || (current.to && String(current.to).toUpperCase() !== flight.to)) throw new Error(t('paidFlight.mismatch'))
      const patch = Object.fromEntries(Object.entries(flight).filter(([name, value]) => value && !current[name]))
      validateActualTimes({ ...current, ...patch })
      for (const [path, value] of Object.entries(patch)) dispatchFields({ type: 'UPDATE', path, value })
      if (Object.keys(patch).length) setModified(true)
      setMessage(Object.keys(patch).length ? t('paidFlight.filled') : t('paidFlight.alreadyFilled'))
    } catch (error) { setError((error as Error).message) }
  }
  const matches = (ticket?.flights || []).filter(f => (!from || f.from === from.toUpperCase()) && (!to || f.to === to.toUpperCase()))
  return <section className="flight-provider-lookup" aria-label={t('paidFlight.label')}>
    <div className="flight-provider-heading"><div><strong>{t('paidFlight.title')}</strong>
      <p>{t('paidFlight.intro')}</p></div>
      <button type="button" className="checkin-approve" disabled={busy || !rawNumber || !date} onClick={() => prepare()}>{busy ? t('paidFlight.working') : t('paidFlight.find')}</button></div>
    {offer && <div className="flight-provider-confirm" role="group" aria-label={t('paidFlight.confirmation')}>
      <strong>{t('paidFlight.doubleCheck')}：{offer.request.flight_number} · {offer.request.date}</strong>
      <p>{from || '—'} → {to || '—'} · {t('paidFlight.localDate')}</p>
      <p>{offer.costFen ? t('paidFlight.price', [(offer.costFen / 100).toFixed(2)]) : t('paidFlight.reuse')}</p>
      {!!offer.costFen && <p>{t('paidFlight.limits', [offer.limits.day, offer.limits.month])}</p>}
      {!!offer.costFen && <p>{t('paidFlight.expires')}</p>}
      <label className="flight-provider-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.currentTarget.checked)} />{t('paidFlight.acknowledge')}</label>
      <div className="flight-provider-actions"><button type="button" className="checkin-approve" disabled={busy || !acknowledged} onClick={confirm}>{offer.costFen ? t('paidFlight.confirmPaid') : t('paidFlight.confirmReuse')}</button>
        <button type="button" className="flight-time-clear" disabled={busy} onClick={() => setOffer(null)}>{t('paidFlight.back')}</button></div>
    </div>}
    {ticket && <div className="flight-provider-result" aria-live="polite">
      <p>{ticket.flightNumber} · {ticket.date} · #{ticket.id} · {ticket.status === 'queued' ? t('paidFlight.queued') : ticket.status === 'running' ? t('paidFlight.running') : ticket.status === 'completed' ? t('paidFlight.saved') : ticket.errorCode === 'provider-expired' ? t('paidFlight.expired') : t('paidFlight.unknown')}</p>
      {ticket.status === 'completed' && (!matches.length ? <p>{t('paidFlight.noMatch')}</p> : matches.map((flight, index) => <div className="flight-provider-leg" key={index}>
        <p><strong>{flight.from} → {flight.to}</strong> · {formatRegistration(flight.registration) || '—'} · {flight.aircraft || flight.aircraftCode || '—'}</p>
        <p>{t('paidFlight.scheduled')}：{flight.departureLocal?.replace('T', ' ').slice(0, 16) || '—'} / {flight.arrivalLocal?.replace('T', ' ').slice(0, 16) || '—'}</p>
        <p>{t('paidFlight.actual')}：{[clock(flight.actualDepartureUTC, flight.from), clock(flight.takeoffUTC, flight.from), clock(flight.touchdownUTC, flight.to), clock(flight.actualArrivalUTC, flight.to)].join(' / ')}</p>
        <button type="button" className="checkin-approve" onClick={() => apply(flight)}>{t('paidFlight.fill')}</button>
      </div>))}
      {!['queued', 'running'].includes(ticket.status) && <button type="button" className="flight-time-clear" disabled={busy} onClick={() => prepare(true)}>{t('paidFlight.refresh')}</button>}
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="admin-tool-error">{error}</p>}
  </section>
}
