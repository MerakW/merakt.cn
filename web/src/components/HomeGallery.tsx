'use client'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { GalleryAlbum } from '@/lib/gallery'

export default function HomeGallery({ albums, total }: { albums: GalleryAlbum[]; total: number }) {
  const rail = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [progress, setProgress] = useState(0)
  const update = () => {
    const el = rail.current
    if (el) setProgress(Math.max(0,Math.min(100,Math.round(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth) * 100))))
  }
  useEffect(() => {
    const el = rail.current
    if (!el) return
    const observer = new ResizeObserver(update)
    observer.observe(el); update()
    return () => observer.disconnect()
  }, [])
  function slide(direction: number) {
    const el = rail.current
    el?.scrollBy({ left: direction * el.clientWidth * .7, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || event.pointerType !== 'mouse') return
    const distance = event.clientX - start.x
    if (Math.abs(distance) > 6) {
      start.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.dataset.dragging = 'true'
    }
    if (start.moved) { event.preventDefault(); event.currentTarget.scrollLeft = start.left - distance }
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = Boolean(drag.current?.moved)
    drag.current = null
    event.currentTarget.dataset.dragging = 'false'
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <Localized><section className="home-photos home-gallery" aria-labelledby="home-photos-heading">
    <header className="home-gallery-heading"><h2 id="home-photos-heading">FURSUIT FRIDAY<span>{"@i18n:ui.anotherSideOfMe@"}</span></h2><div className="home-gallery-controls"><button type="button" aria-label="@i18n:ui.previousFursuitFridaySet@" disabled={progress <= 0} onClick={() => slide(-1)}><ArrowIcon direction="left" /></button><button type="button" aria-label="@i18n:ui.nextFursuitFridaySet@" disabled={progress >= 100} onClick={() => slide(1)}><ArrowIcon /></button><a href="/fursuitfriday">{"@i18n:ui.allPhotos@ "}<ArrowIcon direction="up-right" /></a></div></header>
    <div ref={rail} className="home-gallery-rail" onScroll={update} onPointerDown={event => { suppressClick.current=false; if (event.pointerType === 'mouse' && event.button === 0) drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false } }} onPointerMove={move} onPointerUp={stop} onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) drag.current=null }} onPointerCancel={event => { stop(event); suppressClick.current=false }} onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); suppressClick.current=false } }}>
      {albums.map((album, index) => {
        const photo = album.photos[0]
        return <a className="home-gallery-card" key={album.id} href={`/fursuitfriday?album=${album.slug}`} draggable={false} style={{ '--photo-ratio': photo.width / photo.height } as CSSProperties}>
          <div className="home-gallery-visual"><img data-i18n="off" src={photo.display} srcSet={photo.srcSet} sizes="(max-width:650px) 80vw, 60vw" width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" draggable={false}/><span aria-hidden="true">{String(index + 1).padStart(2,'0')}</span></div>
          <div className="home-gallery-caption"><p data-i18n="off" title={album.title}>{album.title}</p><time dateTime={album.date}>{album.date.slice(5).replace('-', '.')}</time></div>
          {photo.credit && <span className="home-gallery-credit">{"@i18n:ui.photoBy@ "}{photo.credit}</span>}
        </a>
      })}
      <a className="home-gallery-all" href="/fursuitfriday"><span>ALL {total}</span><b aria-hidden="true"><ArrowIcon /></b><small>{"@i18n:ui.exploreAllPhotos@"}</small></a>
    </div>
    <div className="home-gallery-progress" role="progressbar" aria-label="@i18n:ui.photoBrowsingProgress@" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ transform: `scaleX(${progress / 100})` }}/></div>
  </section></Localized>
}
