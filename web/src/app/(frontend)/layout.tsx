import FlightDeck from '@/components/FlightDeck'
import TowerControl from '@/components/TowerControl'
import { getFlightPageData } from '@/lib/flights/page-data'
import { isFlightPublic } from '@/lib/flights/public'
import TeamRadio from '@/components/TeamRadio'
import RaceControl from '@/components/RaceControl'
import { getPayload } from 'payload'
import config from '@payload-config'
import ArrowIcon from '@/components/ArrowIcon'
import { imageURL } from '@/lib/assets'
import ThemeControl from '@/components/ThemeControl'
import SiteNav from '@/components/SiteNav'
import type { Metadata } from 'next'
import './site.css'
import './flights.css'
import './flight-archive.css'
import './home-gallery.css'
import './personal.css'
import './journal-motion.css'
import './checkin-terminal.css'
import './cover-lounge.css'
import './aircraft.css'
import './theme.css'
import './home-depth.css'
import './paddock.css'
import './cockpit.css'

const formula1FontFaces = [['Regular',400],['Bold',700],['Black',900]].map(([variant,weight]) =>
  `@font-face{font-family:Formula1;src:url("${imageURL(`/fonts/Formula1-${variant}.ttf`)}") format("truetype");font-weight:${weight};font-style:normal;font-display:swap}`
).join('\n')

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: { default: 'Merak · 数字围场', template: '%s · Merak' }, description: 'Merak 的飞行、毛五影像与生活记录。', metadataBase: new URL('https://merakt.cn'), openGraph: { title: 'MERAK · DIGITAL PADDOCK', description: '飞行、毛五影像与生活记录。HANGZHOU · 30°N / 120°E', url: 'https://merakt.cn', siteName: 'Merak', locale: 'zh_CN', type: 'website', images: [{url: imageURL('/social/paddock-og.png'), width:1200, height:630, alt:'MERAK 数字围场通行证'}] }, twitter: {card:'summary_large_image', images:[imageURL('/social/paddock-og.png')]}, icons: { icon: { url: imageURL('/images/card/merak-mark.svg'), type: 'image/svg+xml' } } }

export default async function Layout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const [settings, notes] = await Promise.all([payload.findGlobal({ slug: 'site-settings', overrideAccess: false, depth: 0 }), payload.find({ collection:'notes',limit:1,sort:'-date',depth:0,overrideAccess:false })])
  const flightData = await getFlightPageData()
  const latestFlight = flightData.flights.filter(f=>isFlightPublic(f)&&f.state==='completed').sort((a,b)=>b.date.localeCompare(a.date))[0]
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA || ''
  return <html lang="zh-CN" suppressHydrationWarning><head><style>{formula1FontFaces}</style><script dangerouslySetInnerHTML={{__html:`try{var t=sessionStorage.getItem('merak-visit-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.telemetry=String(sessionStorage.getItem('merak-telemetry')==='true');sessionStorage.removeItem('merak-cockpit');if(sessionStorage.getItem('merak-flight-deck')==='1'){document.documentElement.dataset.cockpit='flight';document.documentElement.dataset.theme='dark'}}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}} /></head><body>
    <a className="skip-link" href="#main">跳至内容</a>
    <header className="site-nav"><a className="brand" href="/" aria-label="Merak 首页"><span className="brand-wings" aria-hidden="true">//</span>MERAK<span className="brand-caption">DIGITAL<br />PADDOCK</span></a><SiteNav /><div className="nav-tools"><RaceControl mode={settings.trackMode} forza={settings.forzaFerrari} /><ThemeControl /></div></header>
    <FlightDeck />
    <main className="site-main" id="main" tabIndex={-1}>{children}</main>
    <TowerControl latestFlight={latestFlight?.id?{id:latestFlight.id,number:latestFlight.flightNumber||""}:undefined} />
    <TeamRadio note={notes.docs[0]} />
    <footer className="site-footer">
      <div className="footer-identity"><strong>MERAK.</strong><span>無限進步。</span><a className="footer-revision" href="https://github.com/MerakW/merakt.cn"><span className="footer-repo"><img src={imageURL('/images/card/github.svg')} width="13" height="13" alt="" />GitHub</span><span className="footer-build"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h6m8 0h6"/><circle cx="12" cy="12" r="4"/></svg>BUILD / {commit ? commit.slice(0,7).toUpperCase() : 'LOCAL'}</span></a></div>
      <div className="footer-links">

        <a href="/pit-wall">PIT WALL</a><a href="https://status.merakt.cn/status/home">系统状态 <ArrowIcon direction="up-right" /></a><a href="https://beian.miit.gov.cn/">浙ICP备2023006729号-1</a>
      </div>
    </footer>
  </body></html>
}
