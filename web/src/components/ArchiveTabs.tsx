'use client'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** One moving indicator, shared by both archive switchers. */
export default function ArchiveTabs<T extends string>({ value, options, onChange, className, label }: {
  value: T; options: {value:T; label:ReactNode}[]; onChange:(value:T)=>void; className:string; label:string
}) {
  const root=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    const group=root.current
    if(!group)return
    const update=()=>{
      const selected=group.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      if(!selected)return
      group.style.setProperty('--indicator-x',`${selected.offsetLeft}px`)
      group.style.setProperty('--indicator-width',`${selected.offsetWidth}px`)
    }
    update()
    const observer=new ResizeObserver(update);observer.observe(group)
    return ()=>observer.disconnect()
  },[value])
  return <div ref={root} className={`${className} animated-tabs`} role="group" aria-label={label}><span className="tab-indicator" aria-hidden="true" />{options.map(option=><button key={option.value} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>
}
