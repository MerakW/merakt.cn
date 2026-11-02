'use client'
import Localized, { useTranslator } from '@/components/Localized'
import { useCallback, useEffect, useMemo, useState, type Ref } from 'react'
import { FRIEND_TYRES, HEX_PATTERN, RESERVED_TLAS, TLA_PATTERN, buildPitLane, colorTyre, safeHttpURL, type Tyre } from '@/lib/pit-lane'
import { EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/pit-garage-rules'
import { TICKET_PATTERN, formatCard, githubFileURL, githubIssueURL, mailtoURL, type Application } from '@/lib/pit-lane-card'
import { profile } from '@/lib/profile'
import PitBoxCard from './PitBoxCard'
import { clearanceImage } from './clearanceImage'

const MERAK = { name: 'Merak · 数字围场', url: 'https://merakt.cn', logo: 'https://merakt.cn/images/card/merak-mark.svg', description: 'Aviation · F1 · Fursuit Friday — HGH' }
const LINK_FORMATS = {
  TEXT: `名称：${MERAK.name}\n网址：${MERAK.url}\n头像：${MERAK.logo}\n简介：${MERAK.description}`,
  YAML: `name: ${MERAK.name}\nurl: ${MERAK.url}\nlogo: ${MERAK.logo}\ndescription: ${MERAK.description}`,
  HTML: `<a href="${MERAK.url}" title="${MERAK.description}"><img src="${MERAK.logo}" alt="Merak" width="48" height="48">${MERAK.name}</a>`,
}
const TYRE_NAMES: Record<Tyre, string> = { S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTER', W: 'WET' }
const SOCIAL_NAMES: Record<string, string> = { '𝕏': 'X', QQ: 'QQ', DY: '抖音' }
const TICKETS_KEY = 'merak-pit-tickets'
type Channel = 'web' | 'dm' | 'email' | 'github'
const CHANNEL_LABELS: Record<Channel, string> = { web: '@i18n:pitLane.channel.web@', dm: '@i18n:pitLane.channel.dm@', email: '@i18n:pitLane.channel.email@', github: '@i18n:pitLane.channel.github@' }
const STATUS_LABELS: Record<string, string> = { approved: 'pitLane.ticket.approved', rejected: 'pitLane.ticket.rejected', pending: 'pitLane.ticket.pending' }
type Clearance = { ticket: string; tla?: string; status?: string; backlink?: boolean; note?: string; account?: boolean; error?: string }

const savedTickets = (): { ticket: string; tla: string }[] => { try { return JSON.parse(localStorage.getItem(TICKETS_KEY) || '[]') } catch { return [] } }

/** Stewards' Desk: one application card, four ways to hand it in — none of them needs GitHub. */
export default function StewardsDesk({ ref, taken, email }: { ref?: Ref<HTMLDetailsElement>; taken: string[]; email?: string }) {
  const t = useTranslator()
  const [form, setForm] = useState({ tla: '', name: '', url: '', teamColor: '#2349ed', bio: '', coolingMsg: '', tyre: 'auto', contact: '', backlinkUrl: '' })
  const [channel, setChannel] = useState<Channel>('web'), [format, setFormat] = useState<keyof typeof LINK_FORMATS>('TEXT')
  const [busy, setBusy] = useState(false), [ticket, setTicket] = useState(''), [error, setError] = useState(''), [copied, setCopied] = useState('')
  const [lookup, setLookup] = useState(''), [clearances, setClearances] = useState<Clearance[]>([])
  const [account, setAccount] = useState({ on: false, email: '', password: '' })
  const set = (name: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(value => ({ ...value, [name]: name === 'tla' ? event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : event.target.value }))
  const validTLA = TLA_PATTERN.test(form.tla) && !RESERVED_TLAS.has(form.tla) && !taken.includes(form.tla)
  const color = HEX_PATTERN.test(form.teamColor) ? form.teamColor : '#2349ed', matched = colorTyre(color)
  const app: Application = { ...form, tla: form.tla, tyre: form.tyre === 'auto' ? 'auto' : form.tyre as Tyre, teamColor: color, url: safeHttpURL(form.url) || form.url.trim(), backlinkUrl: safeHttpURL(form.backlinkUrl) || '' }
  const preview = useMemo(() => {
    const tla = TLA_PATTERN.test(form.tla) ? form.tla : 'NEW'
    const [box] = buildPitLane([{ id: 'preview', tla, name: form.name.trim() || t('pitLane.vacant.name'), url: safeHttpURL(form.url) || 'https://example.com', teamColor: color,
      bio: form.bio, coolingMsg: form.coolingMsg, tyreMode: form.tyre === 'auto' ? 'auto' : 'manual', tyre: form.tyre === 'auto' ? null : form.tyre as Tyre, bay: taken.length + 1 }])
    return { ...box, tla: TLA_PATTERN.test(form.tla) ? form.tla : '???' }
  }, [form, color, taken.length, t])

  /** Every channel needs the same three essentials before the card is worth sending. */
  function ready(): boolean {
    if (!validTLA) { setError(t(taken.includes(form.tla) ? 'pitLane.error.taken' : form.tla ? 'pitLane.error.tla' : 'pitLane.error.incomplete')); return false }
    if (!form.name.trim()) { setError(t('pitLane.error.incomplete')); return false }
    if (!safeHttpURL(form.url)?.startsWith('https://')) { setError(t('pitLane.error.url')); return false }
    setError(''); return true
  }
  const flash = (key: string) => { setCopied(key); setTimeout(() => setCopied(value => value === key ? '' : value), 1600) }
  const copy = (key: string, text: string) => { void navigator.clipboard?.writeText(text).then(() => flash(key), () => setError(t('pitLane.error.offline'))) }

  const check = useCallback(async (code: string, tla = '') => {
    const value = code.trim().toUpperCase()
    if (!TICKET_PATTERN.test(value)) { setClearances(list => [{ ticket: value, error: 'pitLane.error.ticket' }, ...list.filter(item => item.ticket !== value)]); return }
    try {
      const response = await fetch(`/api/friends/clearance?ticket=${encodeURIComponent(value)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({})) as Omit<Clearance, 'ticket'>
      const item: Clearance = response.ok ? { ticket: value, ...result } : { ticket: value, tla, error: result.error?.startsWith('pitLane.') ? result.error : 'pitLane.error.unavailable' }
      setClearances(list => [item, ...list.filter(entry => entry.ticket !== value)])
    } catch { setClearances(list => [{ ticket: value, tla, error: 'pitLane.error.offline' }, ...list.filter(entry => entry.ticket !== value)]) }
  }, [])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('ticket')
    const saved = savedTickets().slice(0, 4)
    if (requested) setLookup(requested.toUpperCase())
    const id = setTimeout(() => { for (const item of saved) void check(item.ticket, item.tla); if (requested) void check(requested) }, 0)
    return () => clearTimeout(id)
  }, [check])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !ready()) return
    const data = new FormData(event.currentTarget)
    if (data.get('consent') !== 'on') { setError(t('pitLane.error.consent')); return }
    if (account.on && !EMAIL_PATTERN.test(account.email.trim())) { setError(t('garage.error.email')); return }
    if (account.on && (account.password.length < PASSWORD_MIN || account.password.length > PASSWORD_MAX)) { setError(t('garage.error.weak')); return }
    setBusy(true)
    try {
      const response = await fetch('/api/friends/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, tyre: form.tyre === 'auto' ? undefined : form.tyre, consent: true, website: data.get('website'), ...(account.on ? { account: true, accountEmail: account.email.trim(), password: account.password } : {}) }) })
      const result = await response.json().catch(() => ({})) as { error?: string; ticket?: string }
      if (response.ok && result.ticket) {
        setTicket(result.ticket); setAccount(value => ({ ...value, password: '' }))
        try { localStorage.setItem(TICKETS_KEY, JSON.stringify([{ ticket: result.ticket, tla: form.tla }, ...savedTickets()].slice(0, 8))) } catch {}
        void check(result.ticket, form.tla)
      } else setError(t(result.error?.startsWith('pitLane.') ? result.error : 'pitLane.error.unavailable'))
    } catch { setError(t('pitLane.error.offline')) } finally { setBusy(false) }
  }

  async function saveImage() {
    if (!ready()) return
    try {
      const blob = await clearanceImage(app), file = new File([blob], `pit-lane-${app.tla}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] }) && matchMedia('(hover:none)').matches) { await navigator.share({ files: [file], title: `PIT LANE · ${app.tla}` }).catch(() => {}); return }
      const href = URL.createObjectURL(blob), link = Object.assign(document.createElement('a'), { href, download: file.name })
      link.click(); setTimeout(() => URL.revokeObjectURL(href), 4000); flash('image')
    } catch { setError(t('pitLane.error.unavailable')) }
  }
  const open = (url: string) => { if (ready()) window.open(url, '_blank', 'noopener') }
  const channels: Channel[] = email ? ['web', 'dm', 'email', 'github'] : ['web', 'dm', 'github']
  const socials = profile.socials.filter(([code]) => code !== 'GH')

  return <Localized><details className="pl-stewards" id="stewards" ref={ref}>
    <summary><span className="pl-k">STEWARDS &amp; CLEARANCE</span><h2>{"@i18n:pitLane.desk.title@"}</h2><span className="pl-t">EFB · OPEN BRIEFING <i/></span></summary>
    <div className="pl-efb">
      <div className="pl-steps">
        <div className="pl-step"><b>01</b><div><strong>{"@i18n:pitLane.desk.step1@"}</strong><span>{"@i18n:pitLane.desk.step1Body@"}</span></div></div>
        <div className="pl-link">
          <div className="pl-link-bar"><div className="pl-link-tabs" role="tablist" aria-label="@i18n:pitLane.link.title@">{(Object.keys(LINK_FORMATS) as (keyof typeof LINK_FORMATS)[]).map(key => <button key={key} type="button" role="tab" aria-selected={format === key} onClick={() => setFormat(key)}>{key}</button>)}</div>
            <button type="button" className="pl-copy" onClick={() => copy('link', LINK_FORMATS[format])}>{copied === 'link' ? 'COPIED ✓' : 'COPY'}</button></div>
          <pre className="pl-code" data-i18n="off">{LINK_FORMATS[format]}</pre>
        </div>
        <div className="pl-step"><b>02</b><div><strong>{"@i18n:pitLane.desk.step2@"}</strong><span>{"@i18n:pitLane.desk.step2Body@"}</span></div></div>
        <div className="pl-step"><b>03</b><div><strong>{"@i18n:pitLane.desk.step3@"}</strong><span>{"@i18n:pitLane.desk.step3Body@"}</span></div></div>
        <form className="pl-lookup" onSubmit={event => { event.preventDefault(); void check(lookup) }}>
          <label>{"@i18n:pitLane.ticket.lookup@"}<span><input value={lookup} onChange={event => setLookup(event.target.value.toUpperCase())} placeholder="PIT-AST-7K3QZ9" spellCheck={false} autoComplete="off" maxLength={14}/><button>{"@i18n:pitLane.ticket.check@"}</button></span></label>
          {clearances.length > 0 && <ul aria-live="polite">{clearances.map(item => <li key={item.ticket} data-status={item.error ? 'error' : item.status}>
            <code>{item.ticket}</code>{item.tla && <b>{item.tla}</b>}
            <span>{item.error ? t(item.error) : t(STATUS_LABELS[item.status || ''] || STATUS_LABELS.pending)}</span>
            {!item.error && (item.backlink || item.status === 'pending') && <small>{t(item.backlink ? 'pitLane.ticket.backlinkYes' : 'pitLane.ticket.backlinkNo')}</small>}
            {!item.error && item.note && <small className="pl-review" data-i18n="off">{t('pitLane.ticket.note')}{item.note}</small>}
            {!item.error && item.account && (item.status === 'approved' ? <small><a href="/pit-lane/garage">{"@i18n:garage.enter@"} →</a></small> : item.status === 'pending' && <small>{"@i18n:pitLane.ticket.account@"}</small>)}
          </li>)}</ul>}
        </form>
        <p className="pl-garage-link"><a href="/pit-lane/garage">{"@i18n:garage.enter@"} →</a></p>
        <p className="pl-tower-hint">TOWER CONTROL <kbd>⌘ K</kbd> → <code>pit --status</code> · <code>box {taken[0] || 'TLA'}</code></p>
      </div>
      <div className="pl-apply">
        {ticket ? <div className="pl-sent" role="status"><b>CLEARANCE REQUESTED · {form.tla}</b><p>{"@i18n:pitLane.desk.sent@"}</p>
          <div className="pl-ticket"><div><span className="pl-k">{"@i18n:pitLane.ticket.title@"}</span><code data-i18n="off">{ticket}</code></div><button type="button" className="pl-copy" onClick={() => copy('ticket', ticket)}>{copied === 'ticket' ? 'COPIED ✓' : 'COPY'}</button></div>
          <p className="pl-note">{"@i18n:pitLane.ticket.save@"}</p>
          <button type="button" onClick={() => { setTicket(''); setForm(value => ({ ...value, tla: '' })) }}>{"@i18n:pitLane.desk.again@"}</button></div>
        : <form onSubmit={submit} noValidate>
          <div className="pl-row">
            <label className="pl-tla-field">{"@i18n:pitLane.form.tla@"}<input name="tla" value={form.tla} onChange={set('tla')} required minLength={3} maxLength={3} autoComplete="off" spellCheck={false} placeholder="AST" aria-invalid={form.tla.length === 3 && !validTLA}/></label>
            <label>{"@i18n:pitLane.form.name@"}<input name="name" value={form.name} onChange={set('name')} required maxLength={40} placeholder="@i18n:pitLane.form.namePlaceholder@"/></label>
          </div>
          <label>{"@i18n:pitLane.form.url@"}<input name="url" type="url" value={form.url} onChange={set('url')} required inputMode="url" placeholder="https://example.com"/></label>
          <div className="pl-row">
            <label>{"@i18n:pitLane.form.color@"}<span className="pl-color"><input type="color" value={color} onChange={set('teamColor')} aria-label="@i18n:pitLane.form.color@"/><input name="teamColor" value={form.teamColor} onChange={set('teamColor')} maxLength={7} spellCheck={false}/></span></label>
            <label><span>{"@i18n:pitLane.form.tyre@ "}<small>{t('pitLane.form.tyreMatch', [`${TYRE_NAMES[matched]} · ${matched}`])}</small></span><select name="tyre" value={form.tyre} onChange={set('tyre')} data-tyre={form.tyre === 'auto' ? matched : form.tyre}>
              <option value="auto">{"@i18n:pitLane.form.tyreAuto@"} · {matched}</option>{FRIEND_TYRES.map(tyre => <option key={tyre} value={tyre}>{TYRE_NAMES[tyre]} · {tyre}</option>)}</select></label>
          </div>
          <p className="pl-note">{"@i18n:pitLane.form.tyreHelp@"}</p>
          <label>{"@i18n:pitLane.form.bio@"}<input name="bio" value={form.bio} onChange={set('bio')} maxLength={40} placeholder="Cleared for takeoff."/></label>
          <div className="pl-row">
            <label>{"@i18n:pitLane.form.cooling@"}<input name="coolingMsg" value={form.coolingMsg} onChange={set('coolingMsg')} maxLength={24} placeholder="@i18n:pitLane.card.visit@"/></label>
            <label><span>{"@i18n:pitLane.form.backlink@ "}<small>{"@i18n:pitLane.form.backlinkHelp@"}</small></span><input name="backlinkUrl" type="url" value={form.backlinkUrl} onChange={set('backlinkUrl')} inputMode="url" placeholder="https://example.com/links"/></label>
          </div>

          <fieldset className="pl-channels">
            <legend className="pl-k">{"@i18n:pitLane.channel.title@"}</legend>
            <div className="pl-channel-tabs" role="tablist">{channels.map(key => <button key={key} type="button" role="tab" aria-selected={channel === key} onClick={() => { setChannel(key); setError('') }}>{CHANNEL_LABELS[key]}</button>)}</div>
            <div className="pl-channel" role="tabpanel" data-channel={channel}>
              {channel === 'web' && <>
                <p>{"@i18n:pitLane.channel.webBody@"}</p>
                <label><span>{"@i18n:pitLane.form.contact@ "}<small>{"@i18n:pitLane.form.contactHelp@"}</small></span><input name="contact" value={form.contact} onChange={set('contact')} maxLength={80} autoComplete="email"/></label>
                <label className="pl-consent pl-account-toggle"><input type="checkbox" checked={account.on} onChange={event => setAccount(value => ({ ...value, on: event.target.checked }))}/><span>{"@i18n:pitLane.form.account@"} <small>{"@i18n:pitLane.form.accountHelp@"}</small></span></label>
                {account.on && <div className="pl-row pl-account">
                  <label>{"@i18n:pitLane.form.accountEmail@"}<input name="accountEmail" type="email" value={account.email} onChange={event => setAccount(value => ({ ...value, email: event.target.value }))} autoComplete="email" inputMode="email" maxLength={120} required/></label>
                  <label><span>{"@i18n:pitLane.form.accountPassword@ "}<small>{"@i18n:pitLane.form.accountPasswordHelp@"}</small></span><input name="password" type="password" value={account.password} onChange={event => setAccount(value => ({ ...value, password: event.target.value }))} autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required/></label>
                </div>}
                <div className="checkin-trap" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" aria-label="@i18n:ui.website@"/></div>
                <label className="pl-consent"><input type="checkbox" name="consent" required/>{"@i18n:pitLane.form.consent@"}</label>
                <button className="pl-submit" disabled={busy}>{busy ? "@i18n:ui.submitting@" : "@i18n:pitLane.form.submit@"}</button>
              </>}
              {channel === 'dm' && <>
                <p>{"@i18n:pitLane.channel.dmBody@"}</p>
                <div className="pl-actions">
                  <button type="button" onClick={() => ready() && copy('card', formatCard(app))}>{copied === 'card' ? "@i18n:pitLane.action.copied@" : "@i18n:pitLane.action.copyCard@"}</button>
                  <button type="button" onClick={() => void saveImage()}>{copied === 'image' ? '✓ PNG' : "@i18n:pitLane.action.saveImage@"}</button>
                </div>
                <ul className="pl-socials">{socials.map(([code, handle, , href]) => <li key={code}><a href={href} target="_blank" rel="noopener noreferrer"><b>{SOCIAL_NAMES[code] || code}</b><span data-i18n="off">{handle}</span></a></li>)}</ul>
              </>}
              {channel === 'email' && email && <>
                <p>{"@i18n:pitLane.channel.emailBody@"}</p>
                <div className="pl-actions">
                  <button type="button" onClick={() => { if (ready()) window.location.href = mailtoURL(email, app) }}>{"@i18n:pitLane.action.openMail@"}</button>
                  <button type="button" onClick={() => copy('mail', email)}>{copied === 'mail' ? "@i18n:pitLane.action.copied@" : "@i18n:pitLane.action.copyMail@"}</button>
                  <button type="button" onClick={() => ready() && copy('card', formatCard(app))}>{copied === 'card' ? "@i18n:pitLane.action.copied@" : "@i18n:pitLane.action.copyCard@"}</button>
                </div>
                <code className="pl-mail" data-i18n="off">{email}</code>
              </>}
              {channel === 'github' && <>
                <p>{t('pitLane.channel.githubBody', [form.tla || 'TLA'])}</p>
                <div className="pl-actions">
                  <button type="button" onClick={() => open(githubIssueURL(app))}>{"@i18n:pitLane.action.issue@"} ↗</button>
                  <button type="button" onClick={() => open(githubFileURL(app))}>{"@i18n:pitLane.action.pr@"} ↗</button>
                </div>
              </>}
            </div>
          </fieldset>
          {error && <p role="alert" className="pl-error">{error}</p>}
        </form>}
        <div className="pl-preview" aria-label="@i18n:pitLane.form.preview@"><span className="pl-k">LIVE PREVIEW · {"@i18n:pitLane.form.preview@"}</span><PitBoxCard box={preview} preview/>
          {channel !== 'web' && !ticket && <pre className="pl-card-text" data-i18n="off">{formatCard({ ...app, tla: app.tla || '???' })}</pre>}
        </div>
      </div>
    </div>
  </details></Localized>
}
