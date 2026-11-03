'use client'
import Localized, { useLocale } from '@/components/Localized'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'
const links = [['/', "@i18n:nav.home@"], ['/flights', "@i18n:nav.flights@"], ['/fursuitfriday', "@i18n:nav.fursuitFriday@"], ['/blog', "@i18n:nav.journal@"], ['/visitors', "@i18n:nav.lounge@"], ['/pit-lane', "@i18n:nav.pitLane@"], ['/merak', "@i18n:nav.about@"]]
export default function SiteNav() {
  const locale = useLocale()
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
      fade()
    }
    // On phones the tab row scrolls; fade whichever edge hides more tabs.
    const fade = () => {
      const max = nav.scrollWidth - nav.clientWidth
      const edges = [nav.scrollLeft > 2 && 'start', nav.scrollLeft < max - 2 && 'end'].filter(Boolean).join(' ')
      if (edges) nav.dataset.fade = edges
      else delete nav.dataset.fade
    }
    update()
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
    fade()
    nav.addEventListener('scroll', fade, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    if (header) observer.observe(header)
    return () => { observer.disconnect(); nav.removeEventListener('scroll', fade); document.documentElement.style.removeProperty('--site-nav-height') }
  }, [pathname,locale])
  return <Localized><nav ref={ref} className="main-tabs" aria-label="@i18n:nav.label@">{links.map(([href,label]) => <Link key={href} href={href} aria-current={(href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')) ? 'page' : undefined}>{label}</Link>)}<span className="tab-marker" aria-hidden="true" /></nav></Localized>
}
