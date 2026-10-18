'use client'
import Localized, { useTranslator } from '@/components/Localized'
import PhotoLab from './PhotoLab'
import TitleReveal from '@/components/TitleReveal'
import AutoLoadMore from './AutoLoadMore'
import LoadingImage from './LoadingImage'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryAlbum } from '@/lib/gallery'

export default function PhotoGallery({ albums, initialSlug }: { albums: GalleryAlbum[]; initialSlug?: string }) {
  const t = useTranslator()
  const [year, setYear] = useState('all')
  const [limit, setLimit] = useState(12)
  const [picked, setPicked] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const filtered = useMemo(() => albums.filter(a => year === 'all' || a.date.startsWith(year)), [albums, year])
  const photos = useMemo(() => filtered.flatMap(album => album.photos.map(photo => ({ album, photo }))), [filtered])
  const current = selected === null ? null : photos[selected]
  const isOpen = selected !== null
  const years = [...new Set(albums.map(a => a.date.slice(0, 4)).filter(Boolean))].sort().reverse()
  const hero = filtered[Math.min(picked, Math.max(0, filtered.length - 1))]
  const heroIndex = Math.min(picked, Math.max(0, filtered.length - 1))
  const open = (slug: string, trigger?: HTMLElement) => {
    const index = photos.findIndex(item => item.album.slug === slug)
    if (index < 0) return
    opener.current = trigger || null
    setSelected(index)
  }
  useEffect(() => {
    if (initialSlug) {
      const index = albums.flatMap(album => album.photos.map(photo => ({ album, photo }))).findIndex(item => item.album.slug === initialSlug)
      if (index >= 0) setSelected(index)
    }
  }, [initialSlug, albums])
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.current?.open) dialog.current?.showModal()
    return () => { document.body.style.overflow = previous }
  }, [isOpen])
  const close = () => { dialog.current?.close(); setSelected(null); opener.current?.focus({ preventScroll: true }) }
  const move = (direction: number) => setSelected(value => value === null ? null : (value + direction + photos.length) % photos.length)
  return <Localized><div className="gallery-page">
    <header className="album-heading"><div><p className="kicker">MERAK / FURSUITFRIDAY</p><h1><TitleReveal text="FURSUIT FRIDAY" /></h1></div><div><p>{"@i18n:gallery.intro@"}</p><span>{"@i18n:gallery.dateRange@"}</span></div></header>
    {hero && <section className="album-desk" aria-label="@i18n:ui.browseAlbums@"><div className="album-print"><span className="print-tab">{hero.date.slice(0,4)} / MERAK</span>{hero.photos[0].video ? <button className="photo-button" onClick={e=>open(hero.slug,e.currentTarget)}><span className="video-thumbnail">{"@i18n:ui.playVideo@"}</span></button> : <PhotoLab key={hero.photos[0].id} photo={hero.photos[0]} onOpen={button=>open(hero.slug,button)}/>}<div className="print-footer"><time>{hero.date.replaceAll('-', '.')}</time><span>{String(heroIndex + 1).padStart(2, '0')} / {filtered.length}</span></div></div><div className="album-note"><p data-i18n="off" key={hero.id}>{hero.description || hero.title}</p><div className="album-turn"><button onClick={() => setPicked((heroIndex - 1 + filtered.length) % filtered.length)} aria-label="@i18n:ui.previousEntry@">{"@i18n:ui.previous@"}</button><span aria-hidden="true">/</span><button onClick={() => setPicked((heroIndex + 1) % filtered.length)} aria-label="@i18n:ui.nextEntry@">{"@i18n:ui.next@"}</button></div><a href="#photo-archive" className="quiet-link">{"@i18n:ui.browseAllRecords@"}</a></div></section>}
    <div className="contact-strip" aria-label="@i18n:ui.photoContactSheet@">{filtered.map((album,index) => <button key={album.id} aria-label={t("gallery.selectEntry").replace('{0}',String(index+1)).replace('{1}',album.title)} aria-pressed={hero?.id === album.id} onClick={() => setPicked(index)}>{album.photos[0].video ? <span className="strip-video">▷</span> : <LoadingImage src={album.photos[0].thumbnail} width={120} height={85} alt="" loading="lazy" />}</button>)}</div>

    <section id="photo-archive" className="photo-archive" aria-labelledby="photo-archive-heading"><div className="photo-archive-heading"><div><p className="kicker">PHOTO ARCHIVE</p><h2 id="photo-archive-heading">{"@i18n:ui.theWholeAlbum@"}</h2></div><div className="gallery-filters"><span role="status">{filtered.length} {" @i18n:ui.records2@"}</span><label className="year-filter"><span>{"@i18n:ui.year@"}</span><select aria-label="@i18n:ui.photoYear@" value={year} onChange={e => { setYear(e.target.value); setLimit(12); setPicked(0) }}><option value="all">{"@i18n:ui.allYears@"}</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div></div>
    <div className="photo-grid">{filtered.slice(0, limit).map((album, index) => {
      const photo = album.photos[0]
      return <figure key={album.id} className="photo-record">
        <button className="photo-button" onClick={e => open(album.slug, e.currentTarget)} aria-label={`${t(photo.video ? "@i18n:ui.play@" : "@i18n:ui.enlarge@")}: ${album.title}`}>
          {photo.video ? <span className="video-thumbnail"><span aria-hidden="true">▷</span><span>{"@i18n:ui.video@"}</span></span> : <LoadingImage data-i18n="off" src={photo.thumbnail} srcSet={photo.srcSet} sizes="(max-width: 600px) 90vw, (max-width: 900px) 45vw, 40vw" width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" />}
          {album.photos.length > 1 && <span className="photo-count">{album.photos.length} {" @i18n:ui.photos@"}</span>}
        </button>
        <figcaption><div><time dateTime={album.date}>{album.date.replaceAll('-', '.')}</time>{album.photos.length > 1 && <span>{album.photos.length} {" @i18n:ui.photos@"}</span>}</div><p data-i18n="off">{album.description.split(/\n(?:📷|摄影)\s*[：:]/)[0] || album.title}</p>{photo.credit && <small>{"@i18n:ui.photoBy@ "}{photo.credit}</small>}</figcaption>
      </figure>
    })}</div>
    {!filtered.length && <p className="empty-list">{"@i18n:gallery.empty@"}</p>}
    <AutoLoadMore visible={Math.min(limit, filtered.length)} total={filtered.length} onLoad={() => setLimit(value => Math.min(value + 12, filtered.length))} />
    </section>

    <dialog ref={dialog} className="image-viewer" aria-label="@i18n:ui.photoViewer@" onCancel={close} onClose={() => { setSelected(null); opener.current?.focus({ preventScroll: true }) }} onClick={e => { if (e.target === e.currentTarget) close() }} onKeyDown={e => {
      if (e.target instanceof HTMLVideoElement) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1) }
    }}>
      {current && <div className="viewer-content"><div className="viewer-top"><span aria-live="polite">{selected! + 1} / {photos.length}</span><button autoFocus onClick={close} aria-label="@i18n:ui.closePhoto@">{"@i18n:ui.close@"}</button></div>
      <div className="viewer-stage" onTouchStart={e => { touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } }} onTouchEnd={e => {
        if (!touch.current || current.photo.video) return
        const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
        touch.current = null
      }}>{current.photo.video ? <video key={current.photo.id} src={current.photo.src} controls playsInline preload="metadata" aria-label={current.photo.alt} /> : <LoadingImage key={current.photo.id} src={current.photo.display} width={current.photo.width} height={current.photo.height} alt={current.photo.alt} />}</div>
      <div className="viewer-bottom"><div><time>{current.album.date.replaceAll('-', '.')}</time><p data-i18n="off">{current.photo.caption || current.album.description}</p>{current.photo.source && <a href={current.photo.source} target="_blank" rel="noreferrer">{"@i18n:ui.originalPost@"}</a>}</div><div className="viewer-controls"><button onClick={() => move(-1)} aria-label="@i18n:ui.previousPhoto@">{"@i18n:ui.previous@"}</button><button onClick={() => move(1)} aria-label="@i18n:ui.nextPhoto@">{"@i18n:ui.next@"}</button></div></div></div>}
    </dialog>
  </div></Localized>
}
