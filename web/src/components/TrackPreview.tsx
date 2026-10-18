'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
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
  return <Localized><section className="track-preview" aria-labelledby="track-preview-title">
    <header><div><p className="kicker">RACE CONTROL</p><h2 id="track-preview-title">{"@i18n:ui.appearancePreview@"}</h2></div><button onClick={() => apply('')} disabled={!mode}>{"@i18n:ui.exitPreview@"}</button></header>
    <p>{"@i18n:ui.appliesOnlyToThisBrowserTabVisitorsSee@"}</p>
    <div className="track-preview-options">{choices.map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => apply(value)}>{label}</button>)}</div>
    {mode === 'race' && <label>{"@i18n:ui.grandPrix@ "}<select value={code} onChange={e => apply('race', e.target.value)}>{raceWeekends.map(r => <option key={r.code}>{r.code}</option>)}</select></label>}
    <footer><span role="status">{mode ? i18nMessage('ui.previewingValue0', status.forza ? 'FORZA FERRARI' : status.label) : "@i18n:ui.useCurrentSiteState@"}</span><a href="/">{"@i18n:ui.previewOnHomePage@"}</a><a href="/blog">{"@i18n:ui.viewArticleSector@"}</a><a href="/admin/globals/site-settings">{"@i18n:ui.setPublishedState@"}</a></footer>
  </section></Localized>
}
