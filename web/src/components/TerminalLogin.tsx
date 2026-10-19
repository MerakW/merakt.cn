'use client'
import Localized from '@/components/Localized'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { imageURL } from '@/lib/assets'
import { loginWithPasskey, passkeyError } from '@/lib/passkey-client'
export default function TerminalLogin() {
  const router = useRouter()
  const terminal = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = terminal.current
    if (!node || !node.closest('#pit-login') || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    node.dataset.entrance = 'ready'
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        node.dataset.inView = String(entry.isIntersecting)
        if (entry.isIntersecting) node.dataset.entrance = 'shown'
      }
    }, { threshold: .08 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const [localPort, setLocalPort] = useState('')
  useEffect(() => { if (['localhost','127.0.0.1'].includes(location.hostname)) setLocalPort(location.port) }, [])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false), [away, setAway] = useState(false)
  useEffect(() => {
    setPasskeySupported(window.isSecureContext && Boolean(window.PublicKeyCredential))
    const update = () => setAway(document.hidden)
    update(); document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <Localized><div ref={terminal} className={`terminal-login terminal-v2 terminal-v3${busy ? " terminal-verifying" : ""}${away ? " terminal-paused" : ""}`}><div className="terminal-top"><span>MERAK / CONTROL TERMINAL</span><span>AUTH REQUIRED</span></div><div className="terminal-grid" aria-hidden="true" /><div className="terminal-scan" aria-hidden="true" /><aside className="terminal-signal" aria-label="@i18n:ui.connectionStatus@"><div className="signal-orbit" aria-hidden="true"><i /><i /><i /><span className="signal-avatar"><img src={imageURL("/images/card/avatar.webp")} alt="" width={132} height={132} /><b className="avatar-sweep" /></span></div><p>{busy ? 'VERIFYING IDENTITY' : error ? 'ACCESS DENIED' : 'AWAITING IDENTITY'}</p><ol><li>{"@i18n:ui.consoleReady@"}</li><li>{busy ? "@i18n:ui.verifyingCredentials@" : "@i18n:ui.waitingForAdministratorVerification@"}</li><li>{"@i18n:ui.managementToolsLoadAfterVerification@"}</li></ol></aside><div className="terminal-form"><p className="terminal-prompt">&gt; establish connection<span className="terminal-cursor">_</span></p><h2>{"@i18n:ui.administratorSignIn@"}</h2><p>{localPort === '3002' ? "@i18n:ui.localIsolatedTestSiteSignInWithTest@" : "@i18n:ui.useAPasskeyOrEnterYourAdministratorCredentials@"}</p>{localPort === '3000' && <a className="test-login-link" href="http://127.0.0.1:3002/manage/login">{"@i18n:ui.testAccountOpenTheIsolatedTestSite3002@"}</a>}<button className="passkey-login" type="button" disabled={busy || !passkeySupported} onClick={async () => {
    if (busy) return; setBusy(true); setError('')
    try { await loginWithPasskey(); router.refresh() }
    catch (error) { setError(passkeyError(error)) } finally { setBusy(false) }
  }}><span aria-hidden="true">⌾</span> {" @i18n:ui.signInWithPasskey@ "}<small>PASSKEY</small></button><p className="login-divider">{"@i18n:ui.orUseAPassword@"}</p><form onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      const response = await fetch('/api/users/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      if (!response.ok) { setError(response.status === 429 ? "@i18n:ui.tooManyAttemptsPleaseTryAgainLater@" : "@i18n:ui.incorrectEmailOrPasswordOrTheAccountIs@"); return }
      router.refresh()
    } catch { setError("@i18n:ui.connectionFailedPleaseTryAgainLater@") } finally { setBusy(false) }
  }}><label>{"@i18n:ui.email@"}<input name="email" type="email" autoComplete="username" disabled={busy} required /></label><label>{"@i18n:ui.password@"}<input name="password" type="password" autoComplete="current-password" disabled={busy} required /></label><p role="alert" aria-live="polite">{error}</p><button disabled={busy}>{busy ? "@i18n:ui.verifying@" : "@i18n:ui.connectToConsole@"}</button></form><a href="/">{"@i18n:ui.backToSite@"}</a></div><div className="terminal-bottom">PRIVATE ACCESS <span>MERAK · HANGZHOU</span></div></div></Localized>
}
