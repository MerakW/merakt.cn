'use client'
import { useEffect, useRef, useState } from 'react'
import ArrowIcon from '@/components/ArrowIcon'
import Halftone from '@/components/Halftone'
import { useTranslator } from '@/components/Localized'
import './pit-pages.css'

/** Page-level error (inside the site layout): BOX, BOX — or COMMS OFFLINE. */
export default function PageError({ error, retry, previewOffline }: { error: Error & { digest?: string }; retry: () => void; previewOffline?: boolean }) {
  const t = useTranslator()
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const offline = previewOffline ?? !online

  useEffect(() => { console.error(error) }, [error])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const back = () => { update(); if (previewOffline === undefined) retry() }   // came back online: try again by itself
    update()
    window.addEventListener('online', back); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', back); window.removeEventListener('offline', update) }
  }, [retry, previewOffline])

  const again = () => { if (busy) return; setBusy(true); retry(); timer.current = setTimeout(() => setBusy(false), 1200) }

  return (
    <section className={'pit-page pit-error' + (offline ? ' is-offline' : '')}>
      <div className="pit-copy">
        <div className="pit-code">{offline ? 'COMMS' : 'BOX'}<span>{offline ? 'OFFLINE' : 'INTERRUPTED'}</span></div>
        <p className="kicker">{t('pageError.kicker')}</p>
        <h1>{t(offline ? 'pageError.headingOffline' : 'pageError.heading')}</h1>
        <p className="pit-desc">{t(offline ? 'pageError.descriptionOffline' : 'pageError.description')}</p>
        <div className="pit-actions">
          <button className="pit-button is-primary" type="button" onClick={again} aria-busy={busy || undefined}>{t(busy ? 'common.checking' : 'common.reconnect')} <ArrowIcon /></button>
          <a className="pit-button" href="/">{t('common.paddock')}</a>
        </div>
        {error.digest && <small className="pit-incident">{t('pageError.incident')} / {error.digest}</small>}
      </div>
      <figure className="pit-visual pit-radio">
        <Halftone mode={offline ? 'flat' : 'radio'} className="pit-canvas" />
        <figcaption className="pit-radio-label"><i aria-hidden="true" />{t(offline ? 'pageError.radioOffline' : 'pageError.radio')}</figcaption>
      </figure>
      <div className="pit-grid" aria-hidden="true" />
    </section>
  )
}
