'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'
const links = [['/', '围场'], ['/flights', '飞行'], ['/fursuitfriday', '毛五'], ['/blog', '日志'], ['/visitors', '候机室'], ['/merak', '关于']]
export default function SiteNav() {
  const pathname = usePathname()
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const nav = ref.current
    if (!nav) return
    const header = nav.closest<HTMLElement>('.site-nav')
    const update = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
      nav.style.setProperty('--marker-x', `${active?.offsetLeft || 0}px`)
      nav.style.setProperty('--marker-width', `${active?.offsetWidth || 0}px`)
      if (header) document.documentElement.style.setProperty('--site-nav-height', `${header.getBoundingClientRect().height}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    if (header) observer.observe(header)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--site-nav-height') }
  }, [pathname])
  return <nav ref={ref} className="main-tabs" aria-label="主要导航">{links.map(([href,label]) => <Link key={href} href={href} aria-current={(href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')) ? 'page' : undefined}>{label}</Link>)}<span className="tab-marker" aria-hidden="true" /></nav>
}
