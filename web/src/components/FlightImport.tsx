'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'

import { useState } from 'react'
import type { ImportIssue } from '@/lib/flights/types'

type Preview = {
  totalRows: number; valid: boolean; imported?: number; updated?: number
  updates: { date: string; from: string; to: string; flightNumber?: string; state: string }[]
  flights: { date: string; from: string; to: string; flightNumber?: string; state: string }[]
  duplicates: { row: number; firstRow?: number }[]; issues: ImportIssue[]
}
const states: Record<string, string> = { planned: "@i18n:flightStatus.planned@", completed: "@i18n:flightStatus.completed@", cancelled: "@i18n:flightStatus.cancelled@", unconfirmed: "@i18n:flightStatus.unconfirmed@" }

export default function FlightImport() {
  const [backfill, setBackfill] = useState<{ total: number; withSource: number; updated?: number; updates: { id: number | string; date: string; from: string; to: string; flightNumber?: string; fields: string[] }[]; issues: { id: number | string; message: string }[] } | null>(null)
  const [csv, setCSV] = useState('')
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function recover(action: 'preview' | 'commit') {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/flights/backfill?action=${action}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "@i18n:ui.backfillFailedPleaseTryAgain@")
      setBackfill(data)
    } catch (error) { setError(error instanceof Error ? error.message : "@i18n:ui.networkErrorPleaseTryAgain@") }
    finally { setBusy(false) }
  }
  async function submit(action: 'preview' | 'commit') {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/flights/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv, action }) })
      const data = await response.json()
      if (data.totalRows != null) setPreview(data)
      if (!response.ok) throw new Error(data.error || "@i18n:ui.requestFailedPleaseTryAgain@")
    } catch (error) { setError(error instanceof Error ? error.message : "@i18n:ui.networkErrorPleaseTryAgain@") }
    finally { setBusy(false) }
  }
  return <Localized><section className="import-page">
    <a className="text-link" href="/admin/collections/flights"><ArrowIcon direction="left" /> {" @i18n:ui.manageFlights@"}</a>
    <div className="page-heading"><div><p className="eyebrow">FLIGHT LOG / IMPORT</p><h1>{"@i18n:ui.bringYourFlightsHome@"}</h1></div></div>
    <p>{"@i18n:ui.selectAFlightyCsvExportReviewTheFlights@"}</p>
    <section className="import-upload" aria-label="@i18n:ui.backfillActualFlightTimes@">
      <h2>{"@i18n:ui.backfillActualFlightTimes@"}</h2>
      <p>{"@i18n:ui.restoreGateDepartureTakeoffLandingAndGateArrival@"}</p>
      <button className="solid-button" disabled={busy} onClick={() => recover('preview')}>{busy ? "@i18n:ui.processing@" : "@i18n:ui.checkAvailableBackfills@"}</button>
      {backfill && <div aria-live="polite">
        <p>{backfill.updated != null ? i18nMessage('ui.backfilledValue0Records', backfill.updated) : i18nMessage('ui.ofValue0RecordsValue1HaveSourceDataAnd', backfill.total, backfill.withSource, backfill.updates.length)}</p>
        {!!backfill.updates.length && <details><summary>{"@i18n:ui.viewBackfillDetails@"}</summary>{backfill.updates.map(flight => <p key={flight.id}>{flight.date} · {flight.from} <ArrowIcon /> {flight.to} · {flight.flightNumber || '—'}：{flight.fields.join('、')}</p>)}</details>}
        {!!backfill.issues.length && <details open><summary>{backfill.issues.length} {" @i18n:ui.requireManualReviewAndWereSkipped@"}</summary>{backfill.issues.map(issue => <p key={issue.id}><a href={`/admin/collections/flights/${issue.id}`}>{"@i18n:ui.records3@ "}{issue.id}</a>：{issue.message}</p>)}</details>}
        {backfill.updated == null && !!backfill.updates.length && <button className="solid-button" disabled={busy} onClick={() => recover('commit')}>{"@i18n:ui.backfill@ "}{backfill.updates.length} {" @i18n:ui.records2@"}</button>}
      </div>}
    </section>
    <div className="import-upload">
      <label htmlFor="flight-csv">{"@i18n:ui.flightyCsvFile@ "}<span>{"@i18n:ui.upTo2Mb1000Rows@"}</span></label>
      <input id="flight-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={async event => {
        setPreview(null); setCSV(''); setError('')
        const file = event.target.files?.[0]
        setFilename(file?.name || '')
        if (!file) return
        if (file.size > 2 * 1024 * 1024) { setError("@i18n:ui.fileExceeds2MbSplitItBeforeUploading@"); return }
        try { setCSV(await file.text()) } catch { setError("@i18n:ui.cannotReadTheFilePleaseSelectItAgain@") }
      }} />
      <button className="solid-button" disabled={!csv || busy} onClick={() => submit('preview')}>{busy ? "@i18n:ui.processing@" : "@i18n:ui.previewImport@"}</button>
    </div>
    <p className="import-help">{"@i18n:ui.localAirportTimesAreDetectedForGateDeparture@"}</p>
    {error && <p role="alert" className="import-error">{error}</p>}
    {preview && <div aria-live="polite">
      {preview.imported != null ? <div className="import-success"><h2>{"@i18n:ui.new@ "}{preview.imported} {" @i18n:ui.recordsUpdated@ "}{preview.updated || 0} {" @i18n:ui.records4@"}</h2><p>{"@i18n:ui.skipped@ "}{preview.duplicates.length} {" @i18n:ui.duplicateRecordsYouCanEditLinkTripsOr@"}</p><a className="text-link" href="/admin/collections/flights">{"@i18n:ui.manageFlightRecords@ "}<ArrowIcon direction="up-right" /></a></div> : <>
        <div className="import-summary"><h2>{"@i18n:ui.review@ "}{filename}</h2><p>{preview.totalRows} {" @i18n:ui.rowsNew@ "}{preview.flights.length} {" @i18n:ui.recordsUpdated@ "}{preview.updates.length} {" @i18n:ui.recordsDuplicates@ "}{preview.duplicates.length} {" @i18n:ui.records@"}</p></div>
        {!!preview.duplicates.length && <details><summary>{"@i18n:ui.detectedDuplicates@"}</summary><p>{preview.duplicates.map(d => `${d.row}${d.firstRow ? i18nMessage('ui.sameAsRowValue0', d.firstRow) : "@i18n:ui.alreadyExists@"}`).join('、')}</p></details>}
        {!!preview.issues.length && <div className="import-issues"><h3>{"@i18n:ui.needsAttention@"}</h3><ul>{preview.issues.map((issue, i) => <li key={i}>{"@i18n:ui.row@ "}{issue.row} {" @i18n:ui.row2@"}{issue.field ? ` · ${issue.field}` : ''}：{issue.message}{issue.severity === 'error' ? "@i18n:ui.correctAndUploadAgain@" : ''}</li>)}</ul></div>}
        <div className="import-records">{[...preview.flights, ...preview.updates].map((flight, i) => <div key={i}><time>{flight.date}</time><strong>{flight.from} <ArrowIcon /> {flight.to}</strong><span>{flight.flightNumber || '—'}</span><span>{states[flight.state]}</span></div>)}</div>
        <button className="solid-button" disabled={busy || !preview.valid || !(preview.flights.length + preview.updates.length)} onClick={() => submit('commit')}>{busy ? "@i18n:ui.saving@" : i18nMessage('ui.confirmImportValue0NewValue1Updated', preview.flights.length, preview.updates.length)}</button>
      </>}
    </div>}
  </section></Localized>
}
