'use client'
import TitleReveal from '@/components/TitleReveal'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryAlbum } from '@/lib/gallery'

export default function PhotoGallery({ albums, initialSlug }: { albums: GalleryAlbum[]; initialSlug?: string }) {
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
  return <div className="gallery-page">
    <header className="album-heading"><div><p className="kicker">MERAK / FURSUITFRIDAY</p><h1><TitleReveal text="FURSUIT FRIDAY" /></h1></div><div><p>我去，福瑞控。</p><span>2025.01 — 至今</span></div></header>
    {hero && <section className="album-desk" aria-label="翻看相册"><div className="album-print"><span className="print-tab">{hero.date.slice(0,4)} / MERAK</span><button className="photo-button" onClick={e => open(hero.slug, e.currentTarget)} aria-label={hero.photos[0].video ? '播放选中短片' : '放大选中照片'}>{hero.photos[0].video ? <span className="video-thumbnail"><span aria-hidden="true">▷</span><span>播放短片</span></span> : <img key={hero.id} src={hero.photos[0].display} width={hero.photos[0].width} height={hero.photos[0].height} alt={hero.photos[0].alt} fetchPriority="high" />}</button><div className="print-footer"><time>{hero.date.replaceAll('-', '.')}</time><span>{String(heroIndex + 1).padStart(2, '0')} / {filtered.length}</span></div></div><div className="album-note"><span className="album-note-label">这一张</span><p key={hero.id}>{hero.description || hero.title}</p><div className="album-turn"><button onClick={() => setPicked((heroIndex - 1 + filtered.length) % filtered.length)} aria-label="翻到上一条">上一张</button><span aria-hidden="true">/</span><button onClick={() => setPicked((heroIndex + 1) % filtered.length)} aria-label="翻到下一条">下一张</button></div><a href="#photo-archive" className="quiet-link">翻翻全部记录</a></div></section>}
    <div className="contact-strip" aria-label="照片底片索引">{filtered.map((album,index) => <button key={album.id} aria-label={`选中第 ${index+1} 条：${album.title}`} aria-pressed={hero?.id === album.id} onClick={() => setPicked(index)}>{album.photos[0].video ? <span className="strip-video">▷</span> : <img src={album.photos[0].thumbnail} width={120} height={85} alt="" loading="lazy" />}<span>{String(index+1).padStart(2,'0')}</span></button>)}</div>

    <section id="photo-archive" className="photo-archive" aria-labelledby="photo-archive-heading"><div className="photo-archive-heading"><div><p className="kicker">PHOTO ARCHIVE</p><h2 id="photo-archive-heading">整本相册</h2></div><div className="gallery-filters"><span role="status">{filtered.length} 条记录</span><label className="year-filter"><span>年份</span><select aria-label="影像年份" value={year} onChange={e => { setYear(e.target.value); setLimit(12); setPicked(0) }}><option value="all">全部年份</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div></div>
    <div className="photo-grid">{filtered.slice(0, limit).map((album, index) => {
      const photo = album.photos[0]
      return <figure key={album.id} className="photo-record">
        <button className="photo-button" onClick={e => open(album.slug, e.currentTarget)} aria-label={`${photo.video ? '播放' : '放大'}：${album.title}`}>
          {photo.video ? <span className="video-thumbnail"><span aria-hidden="true">▷</span><span>短片</span></span> : <img src={photo.thumbnail} srcSet={photo.srcSet} sizes="(max-width: 600px) 90vw, (max-width: 900px) 45vw, 40vw" width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" />}
          {album.photos.length > 1 && <span className="photo-count">{album.photos.length} 张</span>}
        </button>
        <figcaption><div><span>{String(index+1).padStart(2,'0')}</span><time dateTime={album.date}>{album.date.replaceAll('-', '.')}</time>{album.photos.length > 1 && <span>{album.photos.length} 张</span>}</div><p>{album.description.split(/\n(?:📷|摄影)\s*[：:]/)[0] || album.title}</p>{photo.credit && <small>摄影 {photo.credit}</small>}</figcaption>
      </figure>
    })}</div>
    {!filtered.length && <p className="empty-list">还没有公开的影像记录。</p>}
    {filtered.length > limit && <div className="gallery-more"><button onClick={() => setLimit(value => value + 12)}>再看 {Math.min(12, filtered.length - limit)} 条</button><span>{limit} / {filtered.length}</span></div>}
    </section>

    <dialog ref={dialog} className="image-viewer" aria-label="照片查看器" onCancel={close} onClose={() => { setSelected(null); opener.current?.focus({ preventScroll: true }) }} onClick={e => { if (e.target === e.currentTarget) close() }} onKeyDown={e => {
      if (e.target instanceof HTMLVideoElement) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1) }
    }}>
      {current && <div className="viewer-content"><div className="viewer-top"><span aria-live="polite">{selected! + 1} / {photos.length}</span><button autoFocus onClick={close} aria-label="关闭照片">关闭 ×</button></div>
      <div className="viewer-stage" onTouchStart={e => { touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } }} onTouchEnd={e => {
        if (!touch.current || current.photo.video) return
        const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
        touch.current = null
      }}>{current.photo.video ? <video key={current.photo.id} src={current.photo.src} controls playsInline preload="metadata" aria-label={current.photo.alt} /> : <img key={current.photo.id} src={current.photo.display} width={current.photo.width} height={current.photo.height} alt={current.photo.alt} />}</div>
      <div className="viewer-bottom"><div><time>{current.album.date.replaceAll('-', '.')}</time><p>{current.photo.caption || current.album.description}</p>{current.photo.source && <a href={current.photo.source} target="_blank" rel="noreferrer">原始发布</a>}</div><div className="viewer-controls"><button onClick={() => move(-1)} aria-label="上一张照片">上一张</button><button onClick={() => move(1)} aria-label="下一张照片">下一张</button></div></div></div>}
    </dialog>
  </div>
}
