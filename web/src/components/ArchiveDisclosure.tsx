'use client'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export default function ArchiveDisclosure({open,children}:{open:boolean;children:ReactNode}) {
  const [mounted,setMounted]=useState(open)
  const root=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    if(open&&!mounted){setMounted(true);return}
    const element=root.current
    if(!element||!mounted)return
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
    if(reduced){if(!open)setMounted(false);return}
    const fullHeight=element.scrollHeight
    const animation=element.animate([
      {height:`${open?0:fullHeight}px`,opacity:open?0:1},
      {height:`${open?fullHeight:0}px`,opacity:open?1:0},
    ],{duration:open?340:220,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'})
    animation.onfinish=()=>{animation.cancel();if(!open)setMounted(false)}
    return ()=>animation.cancel()
  },[open,mounted])
  return <div ref={root} className="archive-disclosure" inert={!open}>{mounted?children:null}</div>
}
