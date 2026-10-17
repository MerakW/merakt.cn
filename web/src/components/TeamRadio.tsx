'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { safeLink } from '@/lib/gallery'
import { imageURL, assetURL } from '@/lib/assets'

export default function TeamRadio({ note }: { note?: { text: string; radioMessages?: { speaker: 'team' | 'driver'; message: string; id?: string | null }[] | null; date: string; link?: string | null } }) {
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [soundError, setSoundError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const sound = useRef<HTMLAudioElement>(null)
  const pathname = usePathname()
  const close = () => { setOpen(false); sound.current?.pause(); trigger.current?.focus() }
  useEffect(() => { setOpen(false); sound.current?.pause() }, [pathname])
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])
  async function play() {
    if (!sound.current) return
    setSoundError(''); sound.current.currentTime = 0; sound.current.volume = .45
    try { await sound.current.play() } catch { setSoundError('音效未能播放，请重试。') }
  }
  if (pathname.startsWith('/manage') || pathname === '/pit-wall') return null
  const messages = note?.radioMessages?.length ? note.radioMessages : [{id: 'fallback', speaker: 'driver', message: note?.text || 'Copy, head down. Next year is our year.'}]
  return <div className="radio-dock" data-open={open}>
    <audio ref={sound} src={assetURL('/audio/team-radio.wav')} preload="none" />
    <button ref={trigger} className="radio-toggle" aria-expanded={open} aria-controls="team-radio-panel" onClick={() => {
      if (open) close()
      else { setOpen(true); if (!muted) void play() }
    }}><b>51</b><span>TEAM<br/>RADIO</span><i aria-hidden="true">{open ? '−' : '+'}</i></button>
    {open && <aside id="team-radio-panel" className="radio-popup" aria-labelledby="radio-title">
      <button className="radio-close" onClick={close} aria-label="关闭车队电台">×</button>
      <div className="radio-broadcast"><h2 id="radio-title"><span>MERAK</span><br/>RADIO</h2>
      <div className="radio-signal"><b>51</b><img src={imageURL('/team-logos/ferrari-hq.svg')} width="68" height="78" alt="Ferrari"/></div>
      <div className="radio-wave" aria-hidden="true">{[48,83,100,100,84,90,74,57,52].map((height,i)=><span key={i} style={{'--wave-height':`${height}%`,'--wave-delay':`${i*-.17}s`} as CSSProperties}><i/><i/></span>)}</div></div>
      <div className="radio-conversation">{messages.map((message,index)=><blockquote key={message.id || index} data-speaker={message.speaker} aria-label={message.speaker==='team'?'车队发言':'车手发言'}>“{message.message}”</blockquote>)}</div>
      <footer><time>{note ? note.date.slice(0, 10).replaceAll('-', '.') : 'STANDBY'}</time><div><button onClick={() => void play()} aria-label="重播车队电台提示音">重播音效</button><button aria-pressed={muted} onClick={() => { setMuted(!muted); sound.current?.pause() }}>{muted ? '开启提示音' : '静音'}</button>{safeLink(note?.link) && <a href={safeLink(note?.link)}>原文 ↗</a>}</div></footer>
      {soundError && <p role="status" className="radio-sound-error">{soundError}</p>}
    </aside>}
  </div>
}
