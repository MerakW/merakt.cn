'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ArrowIcon from '@/components/ArrowIcon'
import Halftone from '@/components/Halftone'
import { useTranslator } from '@/components/Localized'
import '../app/(frontend)/pit-pages.css'

/** 404 · DNF — the requested route sits just outside the radar's range. */
export default function OffTheRadar() {
  const t = useTranslator()
  const path = usePathname() || '/'
  const shown = path.length > 26 ? path.slice(0, 25) + '…' : path
  return (
    <section className="pit-page pit-404">
      <div className="pit-copy">
        <div className="pit-code">404<span>DNF</span></div>
        <p className="kicker">{t('notFound.kicker')}</p>
        <h1>{t('notFound.heading')}</h1>
        <p className="pit-desc">{t('notFound.description')}</p>
        <div className="pit-actions">
          <Link className="pit-button is-primary" href="/">{t('notFound.home')} <ArrowIcon /></Link>
        </div>
        <nav className="pit-routes" aria-label={t('notFound.routes')}>
          <span>{t('notFound.routes')}</span>
          <Link href="/flights">{t('notFound.flights')}</Link>
          <Link href="/blog">{t('notFound.journal')}</Link>
          <Link href="/fursuitfriday">{t('notFound.gallery')}</Link>
        </nav>
      </div>
      <figure className="pit-visual pit-radar">
        <Halftone mode="radar" className="pit-canvas" />
        <figcaption className="pit-contact"><b>{t('notFound.contact')}</b><span>{shown}</span></figcaption>
      </figure>
      <div className="pit-grid" aria-hidden="true" />
    </section>
  )
}
