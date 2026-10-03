'use client'

import { useState } from 'react'
import type { ImportIssue } from '@/lib/flights/types'

type Preview = {
  totalRows: number; valid: boolean; imported?: number
  flights: { date: string; from: string; to: string; flightNumber?: string; state: string }[]
  duplicates: { row: number; firstRow?: number }[]; issues: ImportIssue[]
}
const states: Record<string, string> = { planned: '计划中', completed: '已完成', cancelled: '已取消', unconfirmed: '待确认' }

export default function FlightImport() {
  const [csv, setCSV] = useState('')
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
    <a className="text-link" href="/admin/collections/flights">← 飞行记录管理</a>
    <div className="page-heading"><div><p className="eyebrow">FLIGHT LOG / IMPORT</p><h1>把飞行带回来。</h1></div></div>
    <p>选择 Flighty 导出的 CSV，先核对航段，再导入。新记录默认仅自己可见，可在后台逐条或批量选择公开。</p>
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
    <p className="import-help">自动识别 Date → 日期、From / To → 机场、Gate Departure / Arrival → 两地当地时间。订票编号、座位与原始备注保存在私有信息中。</p>
    {error && <p role="alert" className="import-error">{error}</p>}
    {preview && <div aria-live="polite">
      {preview.imported != null ? <div className="import-success"><h2>已保存 {preview.imported} 条私有记录。</h2><p>跳过 {preview.duplicates.length} 条重复记录。你可以继续编辑、关联旅行，或选择哪些航段公开。</p><a className="text-link" href="/admin/collections/flights">管理飞行记录 ↗</a></div> : <>
        <div className="import-summary"><h2>核对 {filename}</h2><p>{preview.totalRows} 行 · 新增 {preview.flights.length} 条 · 重复 {preview.duplicates.length} 条</p></div>
        {!!preview.duplicates.length && <details><summary>已识别的重复行</summary><p>{preview.duplicates.map(d => `${d.row}${d.firstRow ? `（与第 ${d.firstRow} 行相同）` : '（已有记录）'}`).join('、')}</p></details>}
        {!!preview.issues.length && <div className="import-issues"><h3>需要留意</h3><ul>{preview.issues.map((issue, i) => <li key={i}>第 {issue.row} 行{issue.field ? ` · ${issue.field}` : ''}：{issue.message}{issue.severity === 'error' ? '（请修正后重新上传）' : ''}</li>)}</ul></div>}
        <div className="import-records">{preview.flights.map((flight, i) => <div key={i}><time>{flight.date}</time><strong>{flight.from} → {flight.to}</strong><span>{flight.flightNumber || '—'}</span><span>{states[flight.state]}</span></div>)}</div>
        <button className="solid-button" disabled={busy || !preview.valid || !preview.flights.length} onClick={() => submit('commit')}>{busy ? '正在保存…' : `导入 ${preview.flights.length} 条，设为私有`}</button>
      </>}
    </div>}
  </section>
}
