'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

function today() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}

export default function PhotoPublish({ configured }: { configured: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
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
    if (files.length !== 1) { setError('一次请选择一张图片。'); return }
    const next = files[0]
    if (!/\.(jpe?g|png|webp|avif)$/i.test(next.name)) { setError('请选择 JPG、PNG、WebP 或 AVIF 图片。'); return }
    if (next.size > 30 * 1024 * 1024) { setError('图片不能超过 30 MB。'); return }
    setFile(next)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !file || !caption.trim()) return
    submitting.current = true; setBusy(true); setError(''); setResult(null)
    const form = new FormData()
    form.set('image', file); form.set('caption', caption); form.set('date', date)
    try {
      const response = await fetch('/manage/fursuitfriday/submit', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({ error: response.status === 413 ? '图片超过服务器上传限制，请缩小后重试。' : '服务器暂时无法处理上传，请稍后重试。' }))
      if (!response.ok) throw new Error(data.error || '发布失败，请重试。')
      setResult(data)
    } catch (error) { setError(error instanceof Error ? error.message : '连接失败，请重试。') }
    finally { submitting.current = false; setBusy(false) }
  }
  return <section className="photo-publish">
    <a className="quiet-link" href="/manage">← 管理我的网站</a>
    <header><p className="kicker">FURSUITFRIDAY / NEW</p><h1>发一条毛五。</h1><p>一张照片，一段配文。上传后就会出现在毛五页。</p></header>
    {!configured && <p className="photo-publish-notice" role="status">图片上传服务尚未配置。你可以先选择图片、整理文案。</p>}
    <form onSubmit={submit}>
      <div className={`photo-drop${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files) }}>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={file ? '更换图片' : '选择图片'}>
          {preview ? <><img src={preview} alt="待发布图片预览" /><span>更换图片</span></> : <><strong>把照片拖到这里</strong><span>或点击选择 · JPG / PNG / WebP / AVIF · 30 MB 以内</span></>}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={busy} onChange={event => { choose(event.target.files); event.target.value = '' }} />
      </div>
      <div className="photo-publish-copy">
        <label htmlFor="photo-caption">配文<textarea id="photo-caption" value={caption} onChange={event => { setCaption(event.target.value); setResult(null) }} placeholder="粘贴这次的配文…" required maxLength={10_000} disabled={busy} /></label>
        <label htmlFor="photo-date">记录日期<input id="photo-date" type="date" value={date} onChange={event => { setDate(event.target.value); setResult(null) }} required disabled={busy} /></label>
        <p className="photo-publish-hint">文案中的「摄影：」或「📷：」会自动作为摄影署名。</p>
        <button className="solid-button" type="submit" disabled={busy || !configured || !file || !caption.trim() || Boolean(result)}>{busy ? '正在上传并发布…' : '上传并发布'}</button>
      </div>
    </form>
    {error && <p className="photo-publish-error" role="alert">{error}</p>}
    {result && <div className="photo-publish-success" role="status"><strong>{result.duplicate ? '这条毛五已经发布。' : '发布好了。'}</strong><a href={result.url}>查看这条毛五 ↗</a><button type="button" onClick={() => { setFile(null); setCaption(''); setDate(today()); setResult(null) }}>再发一条</button></div>}
  </section>
}
