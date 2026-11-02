'use client'
import Localized, { useTranslator } from '@/components/Localized'
import { useEffect, useMemo, useState } from 'react'
import { FRIEND_TYRES, HEX_PATTERN, buildPitLane, colorTyre, type Tyre } from '@/lib/pit-lane'
import { EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/pit-garage-rules'
import PitBoxCard from './PitBoxCard'

type Card = { tla: string; name: string; url: string; teamColor: string; bio: string; coolingMsg: string; contact: string; backlinkUrl: string; tyre: string; maintenance: boolean; bay: number | null; email: string; note: string }
type Phase = { kind: 'loading' } | { kind: 'login' } | { kind: 'forgot' } | { kind: 'reset'; token: string; invite: boolean } | { kind: 'garage' }
const TYRE_NAMES: Record<Tyre, string> = { S: 'SOFT', M: 'MEDIUM', H: 'HARD', I: 'INTER', W: 'WET' }
const API = '/api/friends/garage'

async function call(path: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string; friend?: Card } }> {
  const response = await fetch(`${API}/${path}`, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: response.ok, data: await response.json().catch(() => ({})) }
}

/** Team garage: a friend signs in and maintains their own Pit Lane card. TLA and URL stay with Merak. */
export default function Garage() {
  const t = useTranslator()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [card, setCard] = useState<Card | null>(null), [form, setForm] = useState<Card | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [scope, setScope] = useState<'main' | 'password'>('main')
  const [login, setLogin] = useState({ email: '', password: '' }), [secret, setSecret] = useState({ current: '', next: '', confirm: '' })
  const fail = (key?: string) => setError(t(key?.startsWith('pitLane.') || key?.startsWith('garage.') ? key : 'pitLane.error.unavailable'))
  const enter = (friend: Card) => { setCard(friend); setForm(friend); setPhase({ kind: 'garage' }); setError(''); setSecret({ current: '', next: '', confirm: '' }) }

  useEffect(() => {
    const match = window.location.hash.match(/^#(invite|reset)=([\w-]{43})$/)
    if (match) { history.replaceState(null, '', window.location.pathname); setPhase({ kind: 'reset', token: match[2], invite: match[1] === 'invite' }); return }
    call('session').then(({ ok, data }) => ok && data.friend ? enter(data.friend) : setPhase({ kind: 'login' }), () => setPhase({ kind: 'login' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(task: () => Promise<void>, where: 'main' | 'password' = 'main') {
    if (busy) return
    setBusy(true); setError(''); setNotice(''); setScope(where)
    try { await task() } catch { setError(t('pitLane.error.offline')) } finally { setBusy(false) }
  }
  const signIn = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    if (!EMAIL_PATTERN.test(login.email.trim()) || !login.password) return fail('garage.error.credentials')
    const { ok, data } = await call('login', { email: login.email.trim(), password: login.password })
    if (ok && data.friend) { setLogin({ email: '', password: '' }); enter(data.friend) } else fail(data.error)
  }) }
  const forgot = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    if (!EMAIL_PATTERN.test(login.email.trim())) return fail('garage.error.email')
    const { ok, data } = await call('forgot', { email: login.email.trim() })
    if (ok) setNotice(t('garage.forgot.sent')); else fail(data.error)
  }) }
  const reset = (event: React.FormEvent, token: string) => { event.preventDefault(); void run(async () => {
    if (secret.next.length < PASSWORD_MIN || secret.next.length > PASSWORD_MAX) return fail('garage.error.weak')
    if (secret.next !== secret.confirm) return fail('garage.error.mismatch')
    const { ok, data } = await call('reset', { token, password: secret.next })
    if (ok && data.friend) enter(data.friend)
    else if (data.error === 'garage.error.pending' || data.error === 'garage.error.disabled') { setPhase({ kind: 'login' }); fail(data.error) }
    else fail(data.error)
  }) }
  const save = (event: React.FormEvent) => { event.preventDefault(); if (!form) return; void run(async () => {
    if (!form.name.trim()) return fail('pitLane.error.name')
    if (!HEX_PATTERN.test(form.teamColor)) return fail('pitLane.error.color')
    const { ok, data } = await call('update', { name: form.name, teamColor: form.teamColor, tyre: form.tyre, bio: form.bio, coolingMsg: form.coolingMsg, backlinkUrl: form.backlinkUrl, contact: form.contact, maintenance: form.maintenance })
    if (ok && data.friend) { setCard(data.friend); setForm(data.friend); setNotice(t('garage.saved')) } else if (data.error === 'garage.error.signedOut') { setPhase({ kind: 'login' }); fail(data.error) } else fail(data.error)
  }) }
  const changePassword = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    if (secret.next.length < PASSWORD_MIN || secret.next.length > PASSWORD_MAX) return fail('garage.error.weak')
    if (secret.next !== secret.confirm) return fail('garage.error.mismatch')
    const { ok, data } = await call('password', { current: secret.current, next: secret.next })
    if (ok) { setSecret({ current: '', next: '', confirm: '' }); setNotice(t('garage.password.changed')) } else fail(data.error)
  }, 'password') }
  const signOut = () => void run(async () => { await call('logout', {}); setCard(null); setForm(null); setPhase({ kind: 'login' }) })

  const set = (name: keyof Card) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value
    setForm(current => current && { ...current, [name]: value }); setNotice('')
  }
  const color = form && HEX_PATTERN.test(form.teamColor) ? form.teamColor : card?.teamColor || '#2349ed', matched = colorTyre(color)
  const preview = useMemo(() => {
    if (!form) return null
    const [box] = buildPitLane([{ id: 'garage', tla: form.tla, name: form.name.trim() || form.tla, url: form.url, teamColor: color, bio: form.bio, coolingMsg: form.coolingMsg,
      tyreMode: form.tyre === 'auto' ? 'auto' : 'manual', tyre: form.tyre === 'auto' ? null : form.tyre as Tyre, bay: form.bay ?? 1, maintenance: form.maintenance }])
    return box
  }, [form, color])
  const dirty = Boolean(form && card && JSON.stringify(form) !== JSON.stringify(card))
  const status = (where: 'main' | 'password' = 'main') => scope === where && <>{error && <p className="pl-error" role="alert">{error}</p>}{notice && <p className="pl-ok" role="status">{notice}</p>}</>

  return <Localized><section className="pl pl-garage" aria-labelledby="garage-title">
    <header className="pl-head">
      <div>
        <p className="kicker">HGH APRON &amp; PIT LANE / GARAGE</p>
        <h1 id="garage-title">{"@i18n:garage.title@"}</h1>
        <p>{"@i18n:garage.lede@"}</p>
      </div>
      <a className="pl-garage-back" href="/pit-lane">← PIT LANE</a>
    </header>

    {phase.kind === 'loading' && <div className="pl-garage-panel" aria-busy="true"><p className="pl-note">{"@i18n:garage.loading@"}</p></div>}

    {(phase.kind === 'login' || phase.kind === 'forgot') && <div className="pl-garage-panel pl-apply pl-garage-auth">
      <form onSubmit={phase.kind === 'login' ? signIn : forgot} noValidate>
        <span className="pl-k">{phase.kind === 'login' ? 'SIGN IN // TEAM GARAGE' : 'RESET // TEAM GARAGE'}</span>
        <h2>{phase.kind === 'login' ? "@i18n:garage.login.title@" : "@i18n:garage.forgot.title@"}</h2>
        {phase.kind === 'forgot' && <p className="pl-note">{"@i18n:garage.forgot.body@"}</p>}
        <label>{"@i18n:garage.field.email@"}<input type="email" name="email" value={login.email} onChange={event => setLogin(value => ({ ...value, email: event.target.value }))} autoComplete="username" inputMode="email" maxLength={120} required/></label>
        {phase.kind === 'login' && <label>{"@i18n:garage.field.password@"}<input type="password" name="password" value={login.password} onChange={event => setLogin(value => ({ ...value, password: event.target.value }))} autoComplete="current-password" maxLength={PASSWORD_MAX} required/></label>}
        {status()}
        <div className="pl-garage-actions">
          <button className="pl-submit" disabled={busy}>{busy ? "@i18n:ui.submitting@" : phase.kind === 'login' ? "@i18n:garage.login.submit@" : "@i18n:garage.forgot.submit@"}</button>
          <button type="button" className="pl-linkish" onClick={() => { setError(''); setNotice(''); setPhase({ kind: phase.kind === 'login' ? 'forgot' : 'login' }) }}>{phase.kind === 'login' ? "@i18n:garage.login.forgot@" : "@i18n:garage.forgot.back@"}</button>
        </div>
        <p className="pl-note">{"@i18n:garage.login.help@"}</p>
      </form>
    </div>}

    {phase.kind === 'reset' && <div className="pl-garage-panel pl-apply pl-garage-auth">
      <form onSubmit={event => reset(event, phase.token)} noValidate>
        <span className="pl-k">{phase.invite ? 'CLEARANCE // SET PASSWORD' : 'RESET // NEW PASSWORD'}</span>
        <h2>{phase.invite ? "@i18n:garage.reset.inviteTitle@" : "@i18n:garage.reset.title@"}</h2>
        <input type="text" name="username" autoComplete="username" hidden readOnly/>
        <label><span>{"@i18n:garage.field.newPassword@ "}<small>{"@i18n:pitLane.form.accountPasswordHelp@"}</small></span><input type="password" value={secret.next} onChange={event => setSecret(value => ({ ...value, next: event.target.value }))} autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required/></label>
        <label>{"@i18n:garage.field.confirm@"}<input type="password" value={secret.confirm} onChange={event => setSecret(value => ({ ...value, confirm: event.target.value }))} autoComplete="new-password" maxLength={PASSWORD_MAX} required/></label>
        {status()}
        <button className="pl-submit" disabled={busy}>{busy ? "@i18n:ui.submitting@" : "@i18n:garage.reset.submit@"}</button>
      </form>
    </div>}

    {phase.kind === 'garage' && form && card && <div className="pl-garage-panel">
      <div className="pl-garage-bar">
        <span className="pl-k">BOX {String(card.bay ?? '—').padStart(2, '0')} · {card.tla}</span>
        <span className="pl-garage-who" data-i18n="off">{card.email}</span>
        <button type="button" className="pl-copy" onClick={signOut} disabled={busy}>{"@i18n:garage.logout@"}</button>
      </div>
      {card.note && <p className="pl-garage-note"><b>{"@i18n:pitLane.ticket.note@"}</b><span data-i18n="off">{card.note}</span></p>}
      <div className="pl-apply">
        <form onSubmit={save} noValidate>
          <div className="pl-row pl-garage-locked">
            <label>{"@i18n:pitLane.form.tla@"}<input value={card.tla} readOnly disabled/></label>
            <label>{"@i18n:pitLane.form.url@"}<input value={card.url} readOnly disabled/></label>
          </div>
          <p className="pl-note">{"@i18n:garage.locked@"}</p>
          <label>{"@i18n:pitLane.form.name@"}<input name="name" value={form.name} onChange={set('name')} required maxLength={40}/></label>
          <div className="pl-row">
            <label>{"@i18n:pitLane.form.color@"}<span className="pl-color"><input type="color" value={color} onChange={set('teamColor')} aria-label="@i18n:pitLane.form.color@"/><input name="teamColor" value={form.teamColor} onChange={set('teamColor')} maxLength={7} spellCheck={false}/></span></label>
            <label><span>{"@i18n:pitLane.form.tyre@ "}<small>{t('pitLane.form.tyreMatch', [`${TYRE_NAMES[matched]} · ${matched}`])}</small></span><select name="tyre" value={form.tyre} onChange={set('tyre')} data-tyre={form.tyre === 'auto' ? matched : form.tyre}>
              <option value="auto">{"@i18n:pitLane.form.tyreAuto@"} · {matched}</option>{FRIEND_TYRES.map(tyre => <option key={tyre} value={tyre}>{TYRE_NAMES[tyre]} · {tyre}</option>)}</select></label>
          </div>
          <label>{"@i18n:pitLane.form.bio@"}<input name="bio" value={form.bio} onChange={set('bio')} maxLength={40}/></label>
          <div className="pl-row">
            <label>{"@i18n:pitLane.form.cooling@"}<input name="coolingMsg" value={form.coolingMsg} onChange={set('coolingMsg')} maxLength={24} placeholder="@i18n:pitLane.card.visit@"/></label>
            <label><span>{"@i18n:pitLane.form.backlink@ "}<small>{"@i18n:pitLane.form.backlinkHelp@"}</small></span><input name="backlinkUrl" type="url" value={form.backlinkUrl} onChange={set('backlinkUrl')} inputMode="url" placeholder="https://example.com/links"/></label>
          </div>
          <label><span>{"@i18n:pitLane.form.contact@ "}<small>{"@i18n:garage.contactHelp@"}</small></span><input name="contact" value={form.contact} onChange={set('contact')} maxLength={80}/></label>
          <label className="pl-consent"><input type="checkbox" checked={form.maintenance} onChange={set('maintenance')}/><span>{"@i18n:garage.maintenance@"} <small>{"@i18n:garage.maintenanceHelp@"}</small></span></label>
          {status()}
          <button className="pl-submit" disabled={busy || !dirty}>{busy ? "@i18n:ui.submitting@" : "@i18n:garage.save@"}</button>
        </form>
        <div className="pl-preview">
          <span className="pl-k">LIVE PREVIEW</span>
          {preview && <PitBoxCard box={preview} preview/>}
        </div>
      </div>
      <details className="pl-garage-password">
        <summary>{"@i18n:garage.password.title@"}</summary>
        <form className="pl-apply" onSubmit={changePassword} noValidate>
          <input type="email" name="username" value={card.email} autoComplete="username" hidden readOnly/>
          <div className="pl-row">
            <label>{"@i18n:garage.field.current@"}<input type="password" value={secret.current} onChange={event => setSecret(value => ({ ...value, current: event.target.value }))} autoComplete="current-password" maxLength={PASSWORD_MAX} required/></label>
            <label><span>{"@i18n:garage.field.newPassword@ "}<small>{"@i18n:pitLane.form.accountPasswordHelp@"}</small></span><input type="password" value={secret.next} onChange={event => setSecret(value => ({ ...value, next: event.target.value }))} autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required/></label>
          </div>
          <label>{"@i18n:garage.field.confirm@"}<input type="password" value={secret.confirm} onChange={event => setSecret(value => ({ ...value, confirm: event.target.value }))} autoComplete="new-password" maxLength={PASSWORD_MAX} required/></label>
          {status('password')}
          <button className="pl-submit" disabled={busy}>{"@i18n:garage.password.submit@"}</button>
        </form>
      </details>
    </div>}
  </section></Localized>
}
