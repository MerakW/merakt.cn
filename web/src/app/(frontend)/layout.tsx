import { arrivalBootScript, arrivalBootCSS } from '@/lib/site-arrival'
import localFont from 'next/font/local'
import { translatedNote } from '@/lib/i18n/content'
import Localized, { LocaleProvider } from '@/components/Localized'
import LanguageControl from '@/components/LanguageControl'
import SiteArrival from '@/components/SiteArrival'
import { getLocale, getTranslator } from '@/lib/i18n/server'
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

const barlow = localFont({ src: [
  { path: '../../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2', weight: '500' },
  { path: '../../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2', weight: '600' },
], variable: '--font-barlow', display: 'swap', preload: true, adjustFontFallback: false })
const plex = localFont({ src: '../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400', variable: '--font-plex', display: 'swap', preload: true, adjustFontFallback: false })

const formula1FontFaces = [['Regular',400],['Bold',700],['Black',900]].map(([variant,weight]) =>
  `@font-face{font-family:Formula1;src:url("${imageURL(`/fonts/Formula1-${variant}.ttf`)}") format("truetype");font-weight:${weight};font-style:normal;font-display:swap}`
).join('\n')

export const dynamic = 'force-dynamic'

const siteMetadata: Metadata = { title: { default: "@i18n:site.title@", template: '%s · Merak' }, description: "@i18n:site.description@", metadataBase: new URL('https://merakt.cn'), openGraph: { title: 'MERAK · DIGITAL PADDOCK', description: "@i18n:ui.flightsFursuitFridayAndEverydayStoriesHangzhou30@", url: 'https://merakt.cn', siteName: 'Merak', locale: 'zh_CN', type: 'website', images: [{url: imageURL('/social/paddock-og.png'), width:1200, height:630, alt:"@i18n:ui.merakDigitalPaddockPass@"}] }, twitter: {card:'summary_large_image', images:[imageURL('/social/paddock-og.png')]}, icons: { icon: { url: imageURL('/images/card/merak-mark.svg'), type: 'image/svg+xml' } } }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator()
  const locale = await getLocale()
  return { ...siteMetadata, title: { default: t("site.title"), template: '%s · Merak' }, description: t("site.description"), openGraph: { ...siteMetadata.openGraph, locale: locale === 'en' ? 'en_US' : 'zh_CN', description: t("ui.flightsFursuitFridayAndEverydayStoriesHangzhou30"), images: [{url:imageURL('/social/paddock-og.png'),width:1200,height:630,alt:t("ui.merakDigitalPaddockPass")}] } }
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const payload = await getPayload({ config })
  const [settings, notes] = await Promise.all([payload.findGlobal({ slug: 'site-settings', overrideAccess: false, depth: 0 }), payload.find({ collection:'notes',limit:1,sort:'-date',depth:0,overrideAccess:false })])
  const flightData = await getFlightPageData()
  const latestFlight = flightData.flights.filter(f=>isFlightPublic(f)&&f.state==='completed').sort((a,b)=>b.date.localeCompare(a.date))[0]
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA || ''
  return <html className={`${barlow.variable} ${plex.variable}`} lang={locale} suppressHydrationWarning><head><style>{arrivalBootCSS}</style><script dangerouslySetInnerHTML={{__html:arrivalBootScript}}/><link rel="preload" href={imageURL('/fonts/Formula1-Black.ttf')} as="font" type="font/ttf" crossOrigin="anonymous"/><link rel="preload" href={imageURL('/fonts/Formula1-Regular.ttf')} as="font" type="font/ttf" crossOrigin="anonymous"/><style>{formula1FontFaces}</style><script dangerouslySetInnerHTML={{__html:`try{var t=sessionStorage.getItem('merak-visit-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.telemetry=String(sessionStorage.getItem('merak-telemetry')==='true');sessionStorage.removeItem('merak-cockpit');if(sessionStorage.getItem('merak-flight-deck')==='1'){document.documentElement.dataset.cockpit='flight';document.documentElement.dataset.theme='dark'}}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}} /></head><body><SiteArrival /><LocaleProvider locale={locale}><Localized>
    <a className="skip-link" href="#main">{"@i18n:site.skipToContent@"}</a>
    <header className="site-nav"><a className="brand" href="/" aria-label="@i18n:site.homeLabel@"><span className="brand-wings" aria-hidden="true">//</span><span className="brand-word">MERAK</span><span className="brand-caption">DIGITAL<br />PADDOCK</span></a><SiteNav /><div className="nav-tools"><RaceControl mode={settings.trackMode} forza={settings.forzaFerrari} /><ThemeControl /><LanguageControl adminLocaleCookie={`${payload.config.cookiePrefix}-lng`} /></div></header>
    <FlightDeck />
    <main className="site-main" id="main" tabIndex={-1}>{children}</main>
    <TowerControl latestFlight={latestFlight?.id?{id:latestFlight.id,number:latestFlight.flightNumber||""}:undefined} />
    <TeamRadio note={translatedNote(notes.docs[0], locale)} />
    <footer className="site-footer">
      <div className="footer-identity"><strong>MERAK.</strong><span>{"@i18n:site.motto@"}</span><a className="footer-revision" href="https://github.com/MerakW/merakt.cn"><span className="footer-repo"><img src={imageURL('/images/card/github.svg')} width="13" height="13" alt="" />GitHub</span><span className="footer-build"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h6m8 0h6"/><circle cx="12" cy="12" r="4"/></svg>BUILD / {commit ? commit.slice(0,7).toUpperCase() : 'LOCAL'}</span></a></div>
      <div className="footer-links">

        <a href="/pit-wall">PIT WALL</a><a href="https://status.merakt.cn/status/home">{"@i18n:site.status@ "}<ArrowIcon direction="up-right" /></a><a href="https://beian.miit.gov.cn/">{"@i18n:ui.icp20230067291@"}</a>
      </div>
    </footer>
  </Localized></LocaleProvider></body></html>
}
