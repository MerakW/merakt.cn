'use client'

import { useEffect, useRef, useState } from 'react'
import { shouldShowArrival } from '@/lib/site-arrival'
import { arrivalField } from '@/lib/arrival-field'
import { usePathname } from 'next/navigation'
import '../app/(frontend)/site-arrival.css'

/** A single entrance per tab; navigation and assistive technology remain usable. */
export default function SiteArrival() {
  const path = usePathname()
  const [active, setActive] = useState(false)
  const field = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  const particles = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const enter = () => {
      const replay = path === '/' && new URLSearchParams(location.search).has('intro')
      let recovery = false, seen = false
      try {
        recovery = sessionStorage.getItem('merak-recovery-arrival') === '1'
        seen = sessionStorage.getItem('merak-site-arrival') === '1'
      } catch { /* Private browsing can disable storage. */ }
      const root=document.documentElement
      if(root.dataset.merakArrival==='skip'){delete root.dataset.merakArrival;return}
      if(!shouldShowArrival({path,force:replay,seen,recovery,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})){
        if(root.dataset.merakArrival==='pending')delete root.dataset.merakArrival
        return
      }
      setActive(true)
    }
    enter()
    // A full-page recovery screen can return through the browser's back/forward cache.
    const park = (event: PageTransitionEvent) => {
      if(event.persisted)document.documentElement.dataset.merakArrival='pending'
    }
    window.addEventListener('pageshow', enter)
    window.addEventListener('pagehide', park)
    return () => { window.removeEventListener('pageshow', enter); window.removeEventListener('pagehide', park); setActive(false) }
  }, [path])

  useEffect(() => {
    const overlay = field.current, logo = mark.current
    const target = document.querySelector<HTMLElement>('.site-nav .brand')
    if (!active) return
    if (!overlay || !logo || !target) { delete document.documentElement.dataset.merakArrival; setActive(false); return }
    document.documentElement.dataset.merakArrival='playing'
    const animations: Animation[] = []
    const backdrop = overlay.querySelector<HTMLElement>('.site-arrival-backdrop')!
    const previousOpacity = target.style.opacity
    let frame = 0, done = false
    let stopField = () => {}
    const finish = () => {
      if (done) return
      done = true
      target.style.opacity = previousOpacity
      setActive(false)
    }
    // Always release the entrance, even if fonts or an animation fail to load.
    const release = setTimeout(finish, 3400)
    const begin = () => {
      if (done) return
      frame = requestAnimationFrame(() => {
        if (done) return
        const bounds = target.getBoundingClientRect(), targetStyle = getComputedStyle(target)
        const inset = (property: string) => parseFloat(targetStyle.getPropertyValue(property)) || 0
        const to = { left: bounds.left + inset('padding-left'), top: bounds.top + inset('padding-top'),
          width: bounds.width - inset('padding-left') - inset('padding-right'),
          height: bounds.height - inset('padding-top') - inset('padding-bottom') }
        if (!to.width) { finish(); return }
        // Render the opening at its actual large size; never enlarge a small text bitmap.
        const scale = Math.min(4, innerWidth * .82 / to.width)
        const enlarge = (node: HTMLElement, source: HTMLElement, properties: string[]) => {
          const style = getComputedStyle(source)
          node.style.fontFamily=style.fontFamily;node.style.fontWeight=style.fontWeight;node.style.fontStyle=style.fontStyle;node.style.fontStretch=style.fontStretch
          for (const property of properties) {
            const raw=style.getPropertyValue(property), value=parseFloat(raw)
            node.style.setProperty(property,Number.isFinite(value)?`${value*scale}px`:raw)
          }
        }
        enlarge(logo,target,['font-size','column-gap','line-height','letter-spacing'])
        for (const selector of ['.brand-wings','.brand-word','.brand-caption']) {
          const node=logo.querySelector<HTMLElement>(selector), source=target.querySelector<HTMLElement>(selector)
          if(node&&source){
            node.style.display=getComputedStyle(source).display
            enlarge(node,source,['font-size','line-height','letter-spacing','margin-left','margin-right','padding-left','padding-right','border-left-width'])
          }
        }
        // Italic glyphs overhang their advance box; reserve real paint space before compositing.
        const paintPad=Math.ceil(parseFloat(getComputedStyle(logo).fontSize)*.25)
        logo.style.padding=`${paintPad}px`
        const from = logo.getBoundingClientRect()
        if (!from.width) { finish(); return }
        try { sessionStorage.setItem('merak-site-arrival', '1'); sessionStorage.removeItem('merak-recovery-arrival') } catch {}
        target.style.opacity = '0'
        if(particles.current)stopField=arrivalField(particles.current,getComputedStyle(overlay).getPropertyValue('--arrival-particle').trim())
        const end = `translate(calc(-50% + ${to.left + to.width / 2 - from.left - from.width / 2}px), calc(-50% + ${to.top + to.height / 2 - from.top - from.height / 2}px)) scale(${to.width / (from.width - paintPad*2)})`
        const appear=logo.animate([{opacity:0},{opacity:1}],{delay:380,duration:250,fill:'forwards'})
        const move=logo.animate([
          {transform:'translate(-50%, -50%)'},
          {transform:end},
        ],{delay:1250,duration:1000,easing:'cubic-bezier(.7,0,.15,1)',fill:'forwards'})
        const fade=backdrop.animate([{opacity:1,offset:0},{opacity:1,offset:.72},{opacity:0,offset:1}],{duration:2280,fill:'forwards'})
        animations.push(appear,move,fade)
        move.onfinish=()=>{
          if(done)return
          // The real nav is painted underneath before the large mark leaves.
          target.style.opacity=previousOpacity
          const handoff=logo.animate([{opacity:1},{opacity:0}],{duration:80,fill:'forwards'})
          animations.push(handoff)
          handoff.onfinish=finish
        }
      })
    }
    // Wait only for the two logo fonts, with a bounded fallback for unavailable fonts.
    const fontTimer=setTimeout(begin,500)
    const caption=target.querySelector<HTMLElement>('.brand-caption'), word=target.querySelector<HTMLElement>('.brand-word')||target
    Promise.all([document.fonts.load(`${getComputedStyle(word).fontWeight} ${getComputedStyle(word).fontSize} ${getComputedStyle(word).fontFamily}`,'MERAK'), ...(caption?[document.fonts.load(getComputedStyle(caption).font,'DIGITAL PADDOCK')]:[])])
      .then(()=>{clearTimeout(fontTimer);if(!frame)begin()}).catch(()=>{})
    return () => { done = true; delete document.documentElement.dataset.merakArrival; clearTimeout(release); clearTimeout(fontTimer); cancelAnimationFrame(frame); stopField(); animations.forEach(animation => animation.cancel()); target.style.opacity = previousOpacity }
  }, [active])

  if (!active) return null
  return <div ref={field} className="site-arrival" aria-hidden="true">
    <div className="site-arrival-backdrop"><div className="site-arrival-field" />
    <canvas ref={particles} className="site-arrival-particles" /></div>
    <div ref={mark} className="brand site-arrival-mark"><span className="brand-wings">//</span><span className="brand-word">MERAK</span><span className="brand-caption">DIGITAL<br />PADDOCK</span></div>
  </div>
}
