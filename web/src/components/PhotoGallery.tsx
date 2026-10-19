'use client'
import Localized, { useLocale, useTranslator } from '@/components/Localized'
import LoadingImage from './LoadingImage'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { creditParts, creditsOf, personKey, withoutCredits, type CreditRole, type GalleryAlbum, type GalleryPhoto } from '@/lib/gallery'
import { message } from '@/lib/i18n/core'

const REEL = 6
const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`)
const fullDate = (date: string) => date.replaceAll('-', '.')
/** The first line worth reading: not a credit line, not just hashtags. */
const firstLine = (album: GalleryAlbum) => [album.title, ...album.description.split('\n')].map(line => withoutCredits(line)).find(line => line && !/^(#\S+\s*)+$/.test(line) && !/^毛五 · \d{4}-\d{2}-\d{2}$/.test(line)) || ''
const ratio = (photo: GalleryPhoto) => ({ '--ar': `${photo.width || 4} / ${photo.height || 5}`, '--arn': ((photo.width || 4) / (photo.height || 5)).toFixed(4) }) as CSSProperties
const reveal = (delay: number) => ({ 'data-reveal': '', style: { '--reveal-delay': `${delay}ms` } as CSSProperties })
const calm = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const EXPOSURE_LABELS = {
  camera: "@i18n:gallery.camera@", lens: "@i18n:gallery.lens@", focal: "@i18n:gallery.focal@", filmStock: "@i18n:gallery.filmStock@",
  shutter: "@i18n:gallery.shutter@", aperture: "@i18n:gallery.aperture@", iso: "@i18n:gallery.iso@",
} as const
type ExposureKey = keyof typeof EXPOSURE_LABELS
const ROLE_LABELS: Record<CreditRole, string> = {
  suiter: "@i18n:gallery.suiter@", photo: "@i18n:gallery.photo@", light: "@i18n:gallery.lighting@", edit: "@i18n:gallery.retouch@", maker: "@i18n:gallery.maker@",
}
const BY_ME: Partial<Record<CreditRole, string>> = { photo: "@i18n:gallery.shotByMe@" }
const creditsFor = (album: GalleryAlbum, photo: GalleryPhoto) => creditsOf(`${photo.caption}\n${album.description}`, photo.credit)

/** The camera settings recorded in the CMS for one photo, in the order a photographer reads them. */
function exposureOf(photo?: GalleryPhoto) {
  const data = photo?.exposure
  if (!data) return { film: false, rows: [] as [ExposureKey, string][] }
  const aperture = data.aperture?.trim().replace(/^[fFƒＦｆ]\s*[/／]?\s*/, '')
  const rows: [ExposureKey, string | null | undefined][] = [
    ['camera', data.camera], ['lens', data.lens], ['focal', data.focalLength], ['filmStock', data.filmStock],
    ['shutter', data.shutter], ['aperture', aperture ? `ƒ/${aperture}` : ''], ['iso', data.iso ? String(data.iso) : ''],
  ]
  return { film: data.medium === 'film', rows: rows.filter(([key]) => data.medium !== 'film' ? key !== 'filmStock' : ['camera','lens','filmStock'].includes(key)).map(([key, value]) => [key, value?.trim() || ''] as [ExposureKey, string]).filter(([, value]) => value) }
}

function Readout({ photo, className = '' }: { photo?: GalleryPhoto; className?: string }) {
  const { film, rows } = exposureOf(photo)
  if (!rows.length) return null
  return <Localized><dl className={`ff-readout ${className}`} aria-label="@i18n:ui.cameraSettings@">
    {film && <div className="ff-readout-film"><dt className="ff-sr">{"@i18n:gallery.film@"}</dt><dd>{"@i18n:gallery.film@"}</dd></div>}
    {rows.map(([key, value]) => <div key={key}><dt>{EXPOSURE_LABELS[key]}</dt><dd data-i18n="off">{value}</dd></div>)}
  </dl></Localized>
}

export default function PhotoGallery({ albums, initialSlug }: { albums: GalleryAlbum[]; initialSlug?: string }) {
  const t = useTranslator()
  const locale = useLocale()
  const [shown, setShown] = useState(0)
  const [picked, setPicked] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const ordered = useMemo(() => [...albums].filter(album => album.photos[0]).sort((a, b) => b.date.localeCompare(a.date)), [albums])
  const reel = useMemo(() => ordered.filter(album => !album.photos[0].video).slice(0, REEL), [ordered])
  const byYear = useMemo(() => {
    const groups: { year: string; albums: GalleryAlbum[] }[] = []
    for (const album of ordered) {
      const year = album.date.slice(0, 4)
      if (groups.at(-1)?.year !== year) groups.push({ year, albums: [] })
      groups.at(-1)!.albums.push(album)
    }
    return groups
  }, [ordered])
  const sequence = useMemo(() => ordered.flatMap(album => album.photos.map(photo => ({ album, photo }))), [ordered])
  const current = selected === null ? null : sequence[selected]
  const isOpen = selected !== null
  const active = reel[shown] || reel[0]
  const still = ordered[picked] || ordered[0]
  const first = ordered.at(-1)
  // Everyone credited across the posts, most frequent first: who took the photos, and who has worn Merak.
  const people = useMemo(() => {
    const tally = { photo: new Map<string, number>(), suiter: new Map<string, number>() }
    for (const album of albums) if (album.photos[0]) for (const line of creditsFor(album, album.photos[0])) {
      if (line.role !== 'photo' && line.role !== 'suiter') continue
      for (const name of [...line.names, ...(line.me ? [t("@i18n:gallery.me@")] : [])]) { const key = personKey(name); tally[line.role].set(key, (tally[line.role].get(key) || 0) + 1) }
    }
    const rank = (count: Map<string, number>) => [...count].sort((a, b) => b[1] - a[1]).map(([name]) => name)
    return { photographers: rank(tally.photo), suiters: rank(tally.suiter) }
  }, [albums, t])
  const intl = locale === 'en' ? 'en-US' : 'zh-CN'
  const longFormat = useMemo(() => new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }), [intl])
  const weekdayFormat = useMemo(() => new Intl.DateTimeFormat(intl, { weekday: 'long', timeZone: 'UTC' }), [intl])
  const captionOf = (album: GalleryAlbum) => firstLine(album)
  const spoken = (date: string) => Number.isFinite(dayOf(date)) ? longFormat.format(dayOf(date)) : ''

  const open = useCallback((slug: string, trigger?: HTMLElement | null) => {
    const index = sequence.findIndex(item => item.album.slug === slug)
    if (index < 0) return
    opener.current = trigger || null
    setSelected(index)
  }, [sequence])

  useEffect(() => {
    if (!initialSlug) return
    const index = sequence.findIndex(item => item.album.slug === initialSlug)
    if (index >= 0) setSelected(index)
  }, [initialSlug, sequence])

  // Whatever crosses the middle of the screen becomes the photo the side labels and the still describe.
  useEffect(() => {
    const node = root.current
    if (!node || !('IntersectionObserver' in window)) return
    const watch = (selector: string, pick: (index: number) => void) => {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) pick(Number((entry.target as HTMLElement).dataset.index))
      }, { rootMargin: `-${Math.floor(window.innerHeight * .45)}px 0px -${Math.floor(window.innerHeight * .45)}px 0px` })
      node.querySelectorAll(selector).forEach(element => observer.observe(element))
      return observer
    }
    node.dataset.watch = 'on'
    let frames: IntersectionObserver, rows: IntersectionObserver
    const reset = () => { frames?.disconnect(); rows?.disconnect(); frames = watch('.ff-frame', setShown); rows = watch('.ff-row', setPicked) }
    reset()
    window.addEventListener('resize', reset)
    return () => { frames.disconnect(); rows.disconnect(); window.removeEventListener('resize', reset) }
  }, [reel, byYear])

  // Section entrances. Content stays visible if this never runs.
  useEffect(() => {
    const node = root.current
    if (!node || !('IntersectionObserver' in window) || calm()) return
    node.dataset.motion = 'on'
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.shown = 'true'; observer.unobserve(entry.target) }
    }, { rootMargin: '0px 0px -6% 0px' })
    node.querySelectorAll<HTMLElement>('[data-reveal]:not([data-shown])').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [albums])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.current?.open) dialog.current?.showModal()
    return () => { document.body.style.overflow = previous }
  }, [isOpen])
  const close = () => { dialog.current?.close(); setSelected(null); opener.current?.focus({ preventScroll: true }) }
  const move = (direction: number) => setSelected(value => value === null ? null : (value + direction + sequence.length) % sequence.length)

  const when = (album: GalleryAlbum) => Number.isFinite(dayOf(album.date)) ? <time dateTime={album.date}>{spoken(album.date)} · {weekdayFormat.format(dayOf(album.date))}</time> : null
  const credit = (album: GalleryAlbum, photo = album.photos[0]) => {
    const lines = creditParts(creditsFor(album, photo))
    return lines.length ? <p className="ff-credit">{lines.map(line => {
      const roles = line.selfPortrait ? ["@i18n:gallery.selfPortrait@", ...(line.roles.includes('edit') ? [ROLE_LABELS.edit] : [])] : line.roles.map(role => role === 'suiter' && line.names.length + Number(line.me) > 1 ? "@i18n:gallery.featuring@" : ROLE_LABELS[role])
      const names = [...line.names, ...(line.me ? [t("@i18n:gallery.me@")] : [])]
      return <span key={line.role} className="ff-credit-part">{roles.join(locale === 'en' ? ' & ' : ' / ')}{locale === 'en' ? ': ' : '：'}<span data-i18n="off">{names.join(locale === 'en' ? ', ' : '、')}</span></span>
    })}</p> : null
  }
  const shortCredit = (album: GalleryAlbum) => {
    const photo = creditsFor(album, album.photos[0]).find(line => line.role === 'photo')
    return !photo ? null : photo.names.length ? <span data-i18n="off">{photo.names.join(' ')}</span> : BY_ME.photo
  }
  const indexOf = new Map(ordered.map((album, index) => [album.id, index]))

  return <Localized><div className="ff-page" ref={root}>
    <section id="ff-top" className="ff-reel" aria-labelledby="ff-title">
      <h1 id="ff-title" className="ff-sr">Fursuit Friday</h1>
      <div className="ff-side ff-side-start">
        <p className="ff-word" aria-hidden="true">Fursuit</p>
        <div className="ff-side-low">
        {active && <div className="ff-side-label" aria-hidden="true" key={active.id}>
          {when(active)}
          {captionOf(active) && <p className="ff-caption" data-i18n="off">{captionOf(active)}</p>}
          {credit(active)}
        </div>}
        <div className="ff-side-foot">
          {ordered.length > reel.length && <a className="ff-down" href="#ff-index">{"@i18n:gallery.browseAll@"}</a>}
        </div>
        </div>
      </div>

      <ol className="ff-frames" aria-label={t(message('gallery.reelLabel', reel.length))}>{reel.map((album, index) => {
        const photo = album.photos[0]
        return <li key={album.id} className="ff-frame" data-index={index} data-on={index === shown} style={ratio(photo)}>
          <figure>
            <button className="ff-frame-photo" onClick={e => open(album.slug, e.currentTarget)} aria-label={`${t("@i18n:ui.enlarge@")}: ${spoken(album.date)} ${captionOf(album)}`}>
              <LoadingImage data-i18n="off" src={photo.display} width={photo.width} height={photo.height} alt={photo.alt} loading={index < 2 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} />
            </button>
            <figcaption className="ff-frame-caption">
              {when(album)}
              {captionOf(album) && <p className="ff-caption" data-i18n="off">{captionOf(album)}</p>}
              {credit(album)}
              <Readout photo={photo} />
            </figcaption>
          </figure>
        </li>
      })}
      {!reel.length && <li className="ff-empty">{ordered.length ? <a href="#ff-index">{"@i18n:gallery.browseAll@"}</a> : "@i18n:gallery.empty@"}</li>}</ol>

      <div className="ff-side ff-side-end">
        <p className="ff-word" aria-hidden="true">Friday</p>
        <div className="ff-side-low">{active && <div className="ff-side-label" aria-hidden="true" key={active.id}><Readout photo={active.photos[0]} /></div>}</div>
      </div>
    </section>

    {still && <section id="ff-index" className="ff-index" aria-labelledby="ff-index-heading">
      <header className="ff-index-head">
        <h2 id="ff-index-heading" {...reveal(0)}>{"@i18n:gallery.archiveHeading@"}</h2>
        {first && Number.isFinite(dayOf(first.date)) && <p {...reveal(80)}>{message(ordered.length === 1 ? 'gallery.tallyOne' : 'gallery.tally', longFormat.format(dayOf(first.date)), ordered.length)}</p>}
      </header>
      <div className="ff-still" aria-hidden="true">
        <button className="ff-still-photo" tabIndex={-1} style={ratio(still.photos[0])} onClick={e => open(still.slug, e.currentTarget)} key={still.id}>
          {still.photos[0].video ? <span className="ff-video">{"@i18n:ui.video@"}</span> : <LoadingImage data-i18n="off" src={still.photos[0].display} width={still.photos[0].width} height={still.photos[0].height} alt="" loading="lazy" />}
        </button>
        <div className="ff-still-text" key={`t${still.id}`}>
          {when(still)}
          {captionOf(still) && <p className="ff-caption" data-i18n="off">{captionOf(still)}</p>}
          {credit(still)}
          <Readout photo={still.photos[0]} />
        </div>
      </div>
      <div className="ff-rows">{byYear.map(group => <section key={group.year} aria-labelledby={`ff-y-${group.year}`}>
        <h3 id={`ff-y-${group.year}`}>{group.year} <span>{message(group.albums.length === 1 ? 'gallery.yearCountOne' : 'gallery.yearCount', group.albums.length)}</span></h3>
        <ol>{group.albums.map(album => {
          const index = indexOf.get(album.id)!, photo = album.photos[0]
          return <li key={album.id} className="ff-row" data-index={index} data-on={index === picked}>
            <button onClick={e => open(album.slug, e.currentTarget)} onPointerEnter={() => setPicked(index)} onFocus={() => setPicked(index)} aria-label={`${t(photo.video ? "@i18n:ui.play@" : "@i18n:ui.enlarge@")}: ${spoken(album.date)} ${captionOf(album)}`}>
              <time dateTime={album.date}>{fullDate(album.date).slice(5)}</time>
              <span className="ff-row-caption" data-i18n="off">{captionOf(album)}</span>
              <span className="ff-row-credit">{shortCredit(album)}</span>
            </button>
          </li>
        })}</ol>
      </section>)}</div>
    </section>}

    <footer className="ff-end" aria-labelledby="ff-end-heading">
      <h2 id="ff-end-heading" className="ff-end-word" {...reveal(0)}>Fursuit Friday</h2>
      <div className="ff-end-row">
        <ul className="ff-end-places" {...reveal(80)}>
          {first && <li><button onClick={e => open(first.slug, e.currentTarget)}><span>{"@i18n:gallery.firstFriday@"}</span> {fullDate(first.date)}</button></li>}
        </ul>
        {(people.photographers.length > 0 || people.suiters.length > 0) && <div className="ff-thanks">
          {people.photographers.length > 0 && <section aria-labelledby="ff-thanks-photo" {...reveal(0)}><div className="ff-thanks-heading"><span className="ff-thanks-role" aria-hidden="true">01 / PHOTO</span><h3 id="ff-thanks-photo">{"@i18n:gallery.thanks@"}</h3></div>
            <ul data-i18n="off">{people.photographers.map((name, index) => <li key={name} {...reveal(Math.min(index % 6 * 35, 175))}><span>{name}</span></li>)}</ul></section>}
          {people.suiters.length > 0 && <section aria-labelledby="ff-thanks-suit" {...reveal(0)}><div className="ff-thanks-heading"><span className="ff-thanks-role" aria-hidden="true">02 / IN THE SUIT</span><h3 id="ff-thanks-suit">{"@i18n:gallery.suiterThanks@"}</h3></div>
            <ul data-i18n="off">{people.suiters.map((name, index) => <li key={name} {...reveal(Math.min(index % 6 * 35, 175))}><span>{name}</span></li>)}</ul></section>}
        </div>}
      </div>
      <div className="ff-end-legal">
        <p>Fursuit Friday{first && ` · ${first.date.slice(0, 4)}–${ordered[0].date.slice(0, 4)}`} · Merak</p>
        <a href="#ff-top">{"@i18n:gallery.backToTop@"}</a>
      </div>
    </footer>

    <dialog ref={dialog} className="image-viewer ff-viewer" aria-label="@i18n:ui.photoViewer@" onCancel={close} onClose={() => { setSelected(null); opener.current?.focus({ preventScroll: true }) }} onClick={e => { if (e.target === e.currentTarget) close() }} onKeyDown={e => {
      if (e.target instanceof HTMLVideoElement) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1) }
    }}>
      {current && <div className="viewer-content"><div className="viewer-top"><span aria-live="polite">{selected! + 1} / {sequence.length}</span><button autoFocus onClick={close} aria-label="@i18n:ui.closePhoto@">{"@i18n:ui.close@"}</button></div>
      <div className="viewer-stage" onTouchStart={e => { touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } }} onTouchEnd={e => {
        if (!touch.current || current.photo.video) return
        const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
        touch.current = null
      }}>{current.photo.video ? <video key={current.photo.id} src={current.photo.src} controls playsInline preload="metadata" aria-label={current.photo.alt} /> : <LoadingImage key={current.photo.id} src={current.photo.display} width={current.photo.width} height={current.photo.height} alt={current.photo.alt} />}</div>
      <div className="viewer-bottom"><div><time>{fullDate(current.album.date)}</time>{withoutCredits(current.photo.caption || current.album.description) && <p data-i18n="off">{withoutCredits(current.photo.caption || current.album.description)}</p>}{credit(current.album, current.photo)}<Readout photo={current.photo} className="ff-readout-inline" /><a href={current.photo.src} target="_blank" rel="noreferrer">{"@i18n:gallery.originalImage@"}</a>{current.photo.source && <a href={current.photo.source} target="_blank" rel="noreferrer">{"@i18n:ui.originalPost@"}</a>}</div><div className="viewer-controls"><button onClick={() => move(-1)} aria-label="@i18n:ui.previousPhoto@">{"@i18n:ui.previous@"}</button><button onClick={() => move(1)} aria-label="@i18n:ui.nextPhoto@">{"@i18n:ui.next@"}</button></div></div></div>}
    </dialog>
  </div></Localized>
}
