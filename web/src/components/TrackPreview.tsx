'use client'
import { useEffect, useState } from 'react'
import { trackStatus, raceWeekends } from '@/lib/paddock'

export const previewKey = 'merak-track-preview'
export default function TrackPreview() {
  const [mode, setMode] = useState('')
  const [code, setCode] = useState('SGP')
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(previewKey) || 'null'); if (saved) { setMode(saved.mode); setCode(saved.code || 'SGP') } } catch {}
  }, [])
  function apply(nextMode: string, nextCode = code) {
    setMode(nextMode); setCode(nextCode)
    try {
      if (nextMode) sessionStorage.setItem(previewKey, JSON.stringify({ mode: nextMode, code: nextCode }))
      else sessionStorage.removeItem(previewKey)
    } catch {}
    window.dispatchEvent(new Event('merak-track-preview'))
  }
  const choices = [['clear','TRACK CLEAR'],['race','RACE WEEK'],['sc','SAFETY CAR'],['vsc','VSC ENDING'],['pit','IN PIT'],['forza','FORZA FERRARI']]
  const status = trackStatus(new Date(), mode === 'forza' ? 'clear' : mode, mode === 'forza', code)
  return <section className="track-preview" aria-labelledby="track-preview-title">
    <header><div><p className="kicker">RACE CONTROL</p><h2 id="track-preview-title">外观预览</h2></div><button onClick={() => apply('')} disabled={!mode}>退出预览</button></header>
    <p>仅当前浏览器标签页生效，不修改访客看到的状态。</p>
    <div className="track-preview-options">{choices.map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => apply(value)}>{label}</button>)}</div>
    {mode === 'race' && <label>大奖赛 <select value={code} onChange={e => apply('race', e.target.value)}>{raceWeekends.map(r => <option key={r.code}>{r.code}</option>)}</select></label>}
    <footer><span role="status">{mode ? `预览中：${status.forza ? 'FORZA FERRARI' : status.label}` : '使用站点当前状态'}</span><a href="/">前往首页查看 ↗</a><a href="/blog">查看文章 Sector ↗</a><a href="/admin/globals/site-settings">设置公开状态 ↗</a></footer>
  </section>
}
