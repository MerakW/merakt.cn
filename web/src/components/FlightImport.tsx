'use client'
import ArrowIcon from '@/components/ArrowIcon'

import { useState } from 'react'
import type { ImportIssue } from '@/lib/flights/types'

type Preview = {
  totalRows: number; valid: boolean; imported?: number; updated?: number
  updates: { date: string; from: string; to: string; flightNumber?: string; state: string }[]
  flights: { date: string; from: string; to: string; flightNumber?: string; state: string }[]
  duplicates: { row: number; firstRow?: number }[]; issues: ImportIssue[]
}
const states: Record<string, string> = { planned: '计划中', completed: '已完成', cancelled: '已取消', unconfirmed: '待确认' }

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
      if (!response.ok) throw new Error(data.error || '补齐失败，请重试。')
      setBackfill(data)
    } catch (error) { setError(error instanceof Error ? error.message : '网络异常，请重试。') }
    finally { setBusy(false) }
  }
  async function submit(action: 'preview' | 'commit') {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/flights/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv, action }) })
      const data = await response.json()
      if (data.totalRows != null) setPreview(data)
      if (!response.ok) throw new Error(data.error || '请求失败，请重试。')
    } catch (error) { setError(error instanceof Error ? error.message : '网络异常，请重试。') }
    finally { setBusy(false) }
  }
  return <section className="import-page">
    <a className="text-link" href="/admin/collections/flights"><ArrowIcon direction="left" /> 飞行记录管理</a>
    <div className="page-heading"><div><p className="eyebrow">FLIGHT LOG / IMPORT</p><h1>把飞行带回来。</h1></div></div>
    <p>选择 Flighty 导出的 CSV，先核对航段，再导入。新记录默认仅自己可见，可在后台逐条或批量选择公开。</p>
    <section className="import-upload" aria-label="补齐历史实际时间">
      <h2>补齐历史实际时间</h2>
      <p>从网站已保存的 Flighty 原始行恢复出位、起飞、接地与入位时间。只填空缺，保留现有时间、公开范围与备注，无需再次上传 CSV。</p>
      <button className="solid-button" disabled={busy} onClick={() => recover('preview')}>{busy ? '正在处理…' : '检查可补齐的记录'}</button>
      {backfill && <div aria-live="polite">
        <p>{backfill.updated != null ? `已补齐 ${backfill.updated} 条记录。` : `${backfill.total} 条记录中 ${backfill.withSource} 条保留了原始数据，可补齐 ${backfill.updates.length} 条。`}</p>
        {!!backfill.updates.length && <details><summary>查看补齐明细</summary>{backfill.updates.map(flight => <p key={flight.id}>{flight.date} · {flight.from} <ArrowIcon /> {flight.to} · {flight.flightNumber || '—'}：{flight.fields.join('、')}</p>)}</details>}
        {!!backfill.issues.length && <details open><summary>{backfill.issues.length} 条需要人工核对，已跳过</summary>{backfill.issues.map(issue => <p key={issue.id}><a href={`/admin/collections/flights/${issue.id}`}>记录 {issue.id}</a>：{issue.message}</p>)}</details>}
        {backfill.updated == null && !!backfill.updates.length && <button className="solid-button" disabled={busy} onClick={() => recover('commit')}>补齐 {backfill.updates.length} 条记录</button>}
      </div>}
    </section>
    <div className="import-upload">
      <label htmlFor="flight-csv">Flighty CSV 文件 <span>最多 2 MB · 1,000 行</span></label>
      <input id="flight-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={async event => {
        setPreview(null); setCSV(''); setError('')
        const file = event.target.files?.[0]
        setFilename(file?.name || '')
        if (!file) return
        if (file.size > 2 * 1024 * 1024) { setError('文件超过 2 MB，请拆分后上传。'); return }
        try { setCSV(await file.text()) } catch { setError('无法读取文件，请重新选择。') }
      }} />
      <button className="solid-button" disabled={!csv || busy} onClick={() => submit('preview')}>{busy ? '正在处理…' : '预览导入'}</button>
    </div>
    <p className="import-help">自动识别两地当地时间：Gate Departure → 出位、Take off → 起飞、Landing → 接地、Gate Arrival → 入位。时间冲突优先保留实际入位，并在后台标记待核对。新增记录设为私有；更新保留原有公开范围。</p>
    {error && <p role="alert" className="import-error">{error}</p>}
    {preview && <div aria-live="polite">
      {preview.imported != null ? <div className="import-success"><h2>新增 {preview.imported} 条 · 更新 {preview.updated || 0} 条。</h2><p>跳过 {preview.duplicates.length} 条重复记录。你可以继续编辑、关联旅行，或选择哪些航段公开。</p><a className="text-link" href="/admin/collections/flights">管理飞行记录 <ArrowIcon direction="up-right" /></a></div> : <>
        <div className="import-summary"><h2>核对 {filename}</h2><p>{preview.totalRows} 行 · 新增 {preview.flights.length} 条 · 更新 {preview.updates.length} 条 · 重复 {preview.duplicates.length} 条</p></div>
        {!!preview.duplicates.length && <details><summary>已识别的重复行</summary><p>{preview.duplicates.map(d => `${d.row}${d.firstRow ? `（与第 ${d.firstRow} 行相同）` : '（已有记录）'}`).join('、')}</p></details>}
        {!!preview.issues.length && <div className="import-issues"><h3>需要留意</h3><ul>{preview.issues.map((issue, i) => <li key={i}>第 {issue.row} 行{issue.field ? ` · ${issue.field}` : ''}：{issue.message}{issue.severity === 'error' ? '（请修正后重新上传）' : ''}</li>)}</ul></div>}
        <div className="import-records">{[...preview.flights, ...preview.updates].map((flight, i) => <div key={i}><time>{flight.date}</time><strong>{flight.from} <ArrowIcon /> {flight.to}</strong><span>{flight.flightNumber || '—'}</span><span>{states[flight.state]}</span></div>)}</div>
        <button className="solid-button" disabled={busy || !preview.valid || !(preview.flights.length + preview.updates.length)} onClick={() => submit('commit')}>{busy ? '正在保存…' : `确认导入：新增 ${preview.flights.length} 条 / 更新 ${preview.updates.length} 条`}</button>
      </>}
    </div>}
  </section>
}
