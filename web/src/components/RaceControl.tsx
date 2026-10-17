'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackStatus } from '@/lib/paddock'
export default function RaceControl({ mode, forza }: { mode?: string | null; forza?: boolean | null }) {
  const pathname = usePathname()
  const reading = /^\/blog\/[^/]+/.test(pathname)
  const [title,setTitle] = useState('')
  const [status,setStatus] = useState(() => trackStatus(new Date(0), mode || 'auto', !!forza))
  const [progress,setProgress] = useState(0)
  const [purple,setPurple] = useState(false)
  const [previewing,setPreviewing] = useState(false)
  const [homeProgress,setHomeProgress] = useState(0)
  const [docked,setDocked] = useState(false)
  useEffect(() => {
    const update = () => {
      let preview: { mode: string; code?: string } | null = null
      try { preview = JSON.parse(sessionStorage.getItem('merak-track-preview') || 'null') } catch {}
      setPreviewing(!!preview)
      const next = trackStatus(new Date(), preview ? preview.mode === 'forza' ? 'clear' : preview.mode : mode || 'auto', preview ? preview.mode === 'forza' : !!forza, preview?.code)
      setStatus(next)
      document.documentElement.dataset.track = next.kind
      document.documentElement.dataset.forza = String(next.forza)
      document.documentElement.dataset.trackLabel = next.forza ? 'FORZA FERRARI' : next.label
      window.dispatchEvent(new Event('merak-track-status'))
    }
    update(); const timer = setInterval(update, 60000)
    window.addEventListener('merak-track-preview', update)
    return () => { clearInterval(timer); window.removeEventListener('merak-track-preview', update) }
  },[mode,forza])
  useEffect(() => {
    if (pathname !== '/') { setDocked(false); return }
    let frame = 0
    const update = () => {
      frame = 0
      const cover = document.querySelector('.paddock-cover')
      const nav = document.querySelector('.site-nav')
      setDocked(!!cover && cover.getBoundingClientRect().bottom <= (nav?.getBoundingClientRect().height || 76))
      const range = document.documentElement.scrollHeight - window.innerHeight
      setHomeProgress(range > 0 ? Math.min(1,Math.max(0,window.scrollY / range)) : 0)
    }
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(update); observer.observe(document.body)
    update(); window.addEventListener('scroll',scroll,{passive:true})
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll',scroll) }
  },[pathname])
  useEffect(() => {
    setPurple(false)
    setTitle(document.querySelector('.journal-post h1')?.textContent || '')
    if (!reading) return
    let frame = 0
    let previous = 0
    let history: { at: number; value: number }[] = []
    const update = (scroll = false) => {
      setTitle(document.querySelector('.journal-post h1')?.textContent || document.title.split(' · ')[0])
      const article = document.querySelector('.journal-body')
      const start = article ? article.getBoundingClientRect().top + window.scrollY - 100 : 0
      const end = article ? article.getBoundingClientRect().bottom + window.scrollY - window.innerHeight : document.documentElement.scrollHeight - window.innerHeight
      const range = end - start
      const value = range > 0 ? Math.min(1,Math.max(0,(window.scrollY-start)/range)) : 0
      setProgress(value)
      if (scroll) {
        const at = performance.now()
        history = history.filter(p => at-p.at < 1600)
        if (!history.length) history.push({ at, value: previous })
        if (value > .98 && history.some(p => p.value < .3) && range > window.innerHeight) setPurple(true)
        if (value < .05) setPurple(false)
        history.push({ at, value })
      } else { history = [] }
      previous = value
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(true) }) }
    const onResize = () => update()
    update()
    const observer = new ResizeObserver(onResize); observer.observe(document.body)
    window.addEventListener('scroll',onScroll,{ passive:true })
    window.addEventListener('resize',onResize)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll',onScroll); window.removeEventListener('resize',onResize) }
  },[pathname,reading])
  return <div className="nav-race-status" data-forza={status.forza}><a className="track-pill" data-kind={status.kind} href="/pit-wall" title={status.detail}><i aria-hidden="true"/>{previewing?'PREVIEW · ':''}{status.forza?'FORZA FERRARI':status.label}</a>{pathname==='/'&&<><div className="home-lap-progress" role="progressbar" aria-label="首页浏览进度" aria-valuenow={Math.round(homeProgress*100)} aria-valuemin={0} aria-valuemax={100}><i style={{transform:`scaleX(${homeProgress})`}}/></div>{docked&&<div className="nav-timing-strip nav-marquee" aria-label={`${status.forza?'FORZA FERRARI':status.label} · ${status.detail}`}><div className="nav-marquee-track" aria-hidden="true">{[0,1].map(copy=><div className="nav-marquee-group" key={copy}>{[0,1,2].map(repeat=><span className="nav-marquee-message" key={repeat}><i className="timing-flag"/><b>{status.forza?'FORZA FERRARI':status.label}</b><span>{status.forza?'P1 / VITTORIA · SEMPRE FERRARI':status.kind==='sc'?'NO OVERTAKING · 保持距离':status.kind==='pit'?'BOX BOX · PIT LANE 51':status.kind==='vsc'?'GREEN FLAG NEXT':status.kind==='race'?'LIGHTS OUT · RACE WEEKEND':'HGH / DIGITAL PADDOCK'}</span></span>)}</div>)}</div></div>}</>}{reading && <aside className="reader-bar" aria-label="阅读状态"><a href="/blog" aria-label="返回日志">←</a><span className="reader-title">{title}</span><div className="sector-progress" data-purple={purple} role="progressbar" aria-label="文章阅读进度" aria-valuenow={Math.round(progress*100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={purple?'全场最快':`${Math.round(progress*100)}%`}>{[0,1,2].map(i=><span className="sector" key={i}><small>S{i+1}</small><span><i style={{transform:`scaleX(${Math.max(0,Math.min(1,progress*3-i))})`}}/></span></span>)}</div></aside>}</div>
}
