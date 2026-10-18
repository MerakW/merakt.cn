'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized, { useLocale, useTranslator } from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import { useEffect, useState } from 'react'
import { passkeyError, passkeyRequest, registerPasskey } from '@/lib/passkey-client'

type Key = { id: number; name: string; createdAt: string; lastUsedAt?: string }
export default function PasskeySettings({ initialKeys }: { initialKeys: Key[] }) {
  const locale = useLocale(), t = useTranslator()
  const [keys, setKeys] = useState(initialKeys), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [supported, setSupported] = useState(false)
  useEffect(() => setSupported(window.isSecureContext && Boolean(window.PublicKeyCredential)), [])
  const refresh = async () => setKeys((await passkeyRequest('list')).keys)
  return <Localized><section className="passkey-settings"><p>{"@i18n:ui.signInWithAFingerprintFaceDevicePin@"}</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return
      const form = event.currentTarget, data = new FormData(form)
      setBusy(true); setMessage('')
      try { await registerPasskey(String(data.get('password')), String(data.get('name'))); form.reset(); await refresh(); setMessage("@i18n:ui.passkeyRegisteredYouCanUseItNextTime@") }
      catch (error) { setMessage(passkeyError(error)) } finally { setBusy(false) }
    }}><label>{"@i18n:ui.passkeyName@"}<input name="name" placeholder="@i18n:ui.eGMacbookIphone@" maxLength={80} required /></label><label>{"@i18n:ui.confirmCurrentPassword@"}<input name="password" type="password" autoComplete="current-password" required /></label>
      <button disabled={busy || !supported}>{busy ? "@i18n:ui.waitingForDeviceVerification@" : "@i18n:ui.addPasskey@"}</button>
    </form>{!supported && <p>{"@i18n:ui.useAPasskeyCompatibleBrowserOverHttpsOr@"}</p>}
    <p role="status" aria-live="polite">{message}</p>
    <ul>{keys.map(key => <li key={key.id}><div><strong>{key.name}</strong><small>{"@i18n:ui.added@ "}{new Date(key.createdAt).toLocaleDateString(locale)}{key.lastUsedAt && i18nMessage('ui.lastUsedValue0', new Date(key.lastUsedAt).toLocaleDateString(locale))}</small></div><button disabled={busy} onClick={async () => {
      if (!window.confirm(t(i18nMessage('ui.deleteValue0ThisPasskeyWillNoLongerWork', key.name)))) return
      setBusy(true); setMessage('')
      try { await passkeyRequest('remove', { id: key.id }); await refresh(); setMessage("@i18n:ui.passkeyDeleted@") }
      catch (error) { setMessage(passkeyError(error)) } finally { setBusy(false) }
    }}>{"@i18n:common.delete@"}</button></li>)}</ul>{!keys.length && <p>{"@i18n:ui.noPasskeysRegisteredPasswordSignInRemainsAvailable@"}</p>}<a href="/manage">{"@i18n:ui.backToManagement@ "}<ArrowIcon direction="up-right" /></a></section></Localized>
}
