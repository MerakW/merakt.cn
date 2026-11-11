'use client'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import { PHOTO_UPLOAD_MAX_BYTES } from '@/lib/photo-upload-limits'

import { useEffect, useRef, useState, type FormEvent } from 'react'

function today() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}

export default function PhotoPublish({ configured, photographers = [] }: { configured: boolean; photographers?: { id: number; name: string }[] }) {
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [photographerIDs, setPhotographerIDs] = useState<string[]>([])
  const [captionEn, setCaptionEn] = useState('')
  const [translating, setTranslating] = useState(false)
  const translatingRef = useRef(false)
  const [translation, setTranslation] = useState<{ source: string; text: string } | null>(null)
  const [date, setDate] = useState(today)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; duplicate?: boolean } | null>(null)
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function choose(files: FileList | null) {
    if (submitting.current) return
    setError(''); setResult(null)
    if (!files?.length) return
    if (files.length !== 1) { setError("@i18n:ui.selectOneImageAtATime@"); return }
    const next = files[0]
    if (!/\.(jpe?g|png|webp|avif)$/i.test(next.name)) { setError("@i18n:ui.chooseAJpgPngWebpOrAvifImage@"); return }
    if (next.size > PHOTO_UPLOAD_MAX_BYTES) { setError("@i18n:ui.imagesMustBe100MbOrSmaller@"); return }
    setFile(next)
  }
  async function translateCaption() {
    if (translatingRef.current || !caption.trim()) return
    translatingRef.current = true; setTranslating(true); setError(''); setTranslation(null)
    const source = caption
    try {
      const response = await fetch('/api/translate-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: 'photo-caption', data: { caption: source }, overwrite: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Translation failed')
      setTranslation({ source, text: data.patches[0].value })
    } catch (error) { setError(error instanceof Error ? error.message : 'Translation failed') }
    finally { translatingRef.current = false; setTranslating(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !file || !caption.trim()) return
    submitting.current = true; setBusy(true); setError(''); setResult(null)
    const form = new FormData()
    form.set('photographers', JSON.stringify(photographerIDs));
    form.set('image', file); form.set('caption', caption); form.set('date', date); form.set('captionEn', captionEn)
    try {
      const response = await fetch('/manage/fursuitfriday/submit', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({ error: response.status === 413 ? "@i18n:ui.imageExceedsTheServerUploadLimitResizeAnd@" : "@i18n:ui.uploadsAreTemporarilyUnavailableTryAgainLater@" }))
      if (!response.ok) throw new Error(data.error || "@i18n:ui.publishingFailedPleaseTryAgain@")
      setResult(data)
    } catch (error) { setError(error instanceof Error ? error.message : "@i18n:ui.connectionFailedPleaseTryAgain@") }
    finally { submitting.current = false; setBusy(false) }
  }
  return <Localized><section className="photo-publish">
    <a className="quiet-link" href="/manage"><ArrowIcon direction="left" /> {" @i18n:ui.manageMySite@"}</a>
    <header><p className="kicker">FURSUITFRIDAY / NEW</p><h1>{"@i18n:ui.postAFursuitFriday@"}</h1><p>{"@i18n:ui.onePhotoOneCaptionUploadToShareIt@"}</p></header>
    {!configured && <p className="photo-publish-notice" role="status">{"@i18n:ui.imageUploadsAreNotConfiguredYetYouCan@"}</p>}
    <form onSubmit={submit}>
      <div className={`photo-drop${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files) }}>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={file ? "@i18n:ui.changeImage@" : "@i18n:ui.chooseImage@"}>
          {preview ? <><img src={preview} alt="@i18n:ui.imagePreview@" /><span>{"@i18n:ui.changeImage@"}</span></> : <><strong>{"@i18n:ui.dropAPhotoHere@"}</strong><span>{"@i18n:ui.orClickToChooseJpgPngWebpAvif@"}</span></>}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={busy} onChange={event => { choose(event.target.files); event.target.value = '' }} />
      </div>
      <div className="photo-publish-copy">
        <label htmlFor="photo-caption">{"@i18n:ui.caption@"}<textarea id="photo-caption" value={caption} onChange={event => { setCaption(event.target.value); setResult(null) }} placeholder="@i18n:ui.pasteYourCaption@" required maxLength={10_000} disabled={busy} /></label>
        <label htmlFor="photo-caption-en">{"@i18n:gallery.englishCaption@"}<textarea id="photo-caption-en" lang="en" value={captionEn} onChange={event => { setCaptionEn(event.target.value); setResult(null) }} placeholder="@i18n:gallery.translationFallback@" maxLength={10_000} disabled={busy} /></label>
        <button type="button" className="quiet-link" disabled={busy || translating || !caption.trim()} onClick={translateCaption}>{translating ? '@i18n:translation.working@' : '@i18n:translation.generate@'}</button>
        {translation && <div className="photo-publish-translation">
          <p lang="en" data-i18n="off" style={{ whiteSpace: 'pre-wrap' }}>{translation.text}</p>
          <button type="button" disabled={busy || caption !== translation.source} onClick={() => { setCaptionEn(translation.text); setTranslation(null); setResult(null) }}>{"@i18n:translation.apply@"}</button>
          <button type="button" onClick={() => setTranslation(null)}>{"@i18n:translation.discard@"}</button>
          {caption !== translation.source && <p role="status">{"@i18n:translation.changed@"}</p>}
        </div>}
        <label htmlFor="photo-photographers">{"@i18n:ui.photoCredit@"}<select id="photo-photographers" multiple value={photographerIDs} disabled={busy} onChange={event => setPhotographerIDs(Array.from(event.target.selectedOptions, option => option.value))}>{photographers.map(person => <option key={person.id} value={person.id}>{person.name} · #{person.id}</option>)}</select></label>
        <label htmlFor="photo-date">{"@i18n:ui.date2@"}<input id="photo-date" type="date" value={date} onChange={event => { setDate(event.target.value); setResult(null) }} required disabled={busy} /></label>
        <p className="photo-publish-hint">{"@i18n:ui.orInTheCaptionIsAutomaticallyUsedAs@"}</p>
        <p className="photo-publish-hint">{"@i18n:gallery.exifUploadHint@"}</p>
        <button className="solid-button" type="submit" disabled={busy || !configured || !file || !caption.trim() || Boolean(result)}>{busy ? "@i18n:ui.uploadingAndPublishing@" : "@i18n:ui.uploadAndPublish@"}</button>
      </div>
    </form>
    {error && <p className="photo-publish-error" role="alert">{error}</p>}
    {result && <div className="photo-publish-success" role="status"><strong>{result.duplicate ? "@i18n:ui.thisFursuitFridayPostIsAlreadyPublished@" : "@i18n:ui.published@"}</strong><a href={result.url}>{"@i18n:ui.viewThisPost@ "}<ArrowIcon direction="up-right" /></a><button type="button" onClick={() => { setFile(null); setPhotographerIDs([]); setCaption(''); setCaptionEn(''); setTranslation(null); setDate(today()); setResult(null) }}>{"@i18n:ui.postAnother@"}</button></div>}
  </section></Localized>
}
