import ArrivalRadar from '@/components/ArrivalRadar'
import Comms from '@/components/Comms'
import TyreCompound from '@/components/TyreCompound'
import { compoundFor, richTextContent } from '@/lib/paddock'
import ArrowIcon from '@/components/ArrowIcon'
import { imageURL } from '@/lib/assets'
import HomeFlights from '@/components/HomeFlights'
import SpeedTunnel from '@/components/SpeedTunnel'
import HomeMotion from '@/components/HomeMotion'
import HomeGallery from '@/components/HomeGallery'
import HomeTicker from '@/components/HomeTicker'
import FlightCounter from '@/components/FlightCounter'
import RouteMap from '@/components/RouteMap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getGallery } from '@/lib/gallery-server'
import { publicPhoto } from '@/lib/gallery'
import { isFlightPublic, publicFlight, selectFeaturedFlight } from '@/lib/flights/public'
import { flightSouvenirs } from '@/lib/flights/souvenirs'
import { airportMap } from '@/lib/flights/airports'
import { getFlightPageData } from '@/lib/flights/page-data'

export const dynamic = 'force-dynamic'
export default async function Home() {
  const payload = await getPayload({ config })
  const [albums, settings, flights, posts] = await Promise.all([
    getGallery(), payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }),
    getFlightPageData(),
    payload.find({ collection: 'posts', limit: 1, depth: 0, overrideAccess: false, sort: '-date' }),
  ])
  const latest = albums.find(a => !a.photos[0].video)
  const selectedAlbum = albums.find(a => a.id === (typeof settings.featuredAlbum === 'object' ? settings.featuredAlbum?.id : settings.featuredAlbum))
  const customHero = publicPhoto(settings.heroImage)
  const heroAlbum = selectedAlbum || latest
  const hero = (customHero && !customHero.video ? customHero : null) || heroAlbum?.photos.find(p => !p.video)
  const featured = selectFeaturedFlight(flights.flights)
  const intro = '「每个梦都像任意门，往不同世界。」'
  const visibleFlights = flights.flights.filter(flight => isFlightPublic(flight)).map(publicFlight)
  const completed = visibleFlights.filter(flight => flight.state === 'completed')
  const usedCodes = new Set(visibleFlights.flatMap(flight => [flight.from, flight.to, flight.divertedTo].filter(Boolean) as string[]))
  const airports = [...usedCodes].flatMap(code => airportMap.has(code) ? [airportMap.get(code)!] : [])
  const stats = flightSouvenirs(visibleFlights, airports)
  const recentFlights = [...completed].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4)
  const ticker = ['HGH 30°N 120°E', '航空 / F1 / FURRY', `${stats.count} FLIGHTS LOGGED`, `${Math.round(stats.totalKm).toLocaleString('en-US')} KM · EST.`, `${albums.length} FURSUIT FRIDAYS`, '無限進步', 'DIGITAL PADDOCK']
  const latestPhotos = albums.filter(a => !a.photos[0].video && a.photos[0].id !== hero?.id).slice(0, 12)
  return <HomeMotion>
    <header className="paddock-cover">
      <SpeedTunnel />
      <div className="cover-coordinate"><span>MERAK / DIGITAL PADDOCK</span><span>HANGZHOU · 30° N / 120° E</span></div>
      <div className="cover-copy"><p className="cover-greeting">你好，叫我米拉克。</p><p className="cover-intro">{intro}</p><div className="cover-links"><a href="/merak">认识一下 <span aria-hidden="true"><ArrowIcon direction="up-right" /></span></a><a href="/flights">我的航程</a></div></div>
      <figure className="cover-photo">
        <a href={hero && !settings.heroImage && heroAlbum ? `/fursuitfriday?album=${heroAlbum.slug}` : '/fursuitfriday'} aria-label="查看毛五影像"><img src={hero?.display || imageURL('/identity/merak-avatar.webp')} width={hero?.width || 600} height={hero?.height || 600} alt={hero?.alt || 'Merak 的蓝白狐狸角色'} fetchPriority="high" /></a>
        <figcaption><span>另一面的我 / FURSUITFRIDAY</span>{hero?.credit && <span>摄影 {hero.credit}</span>}</figcaption>
      </figure>
      <h1 className="cover-wordmark" aria-label="MERAK.">{Array.from('MERAK.').map((letter,index)=><span aria-hidden="true" key={index} style={{animationDelay:`${index * 65}ms`}}>{letter}</span>)}</h1>
      <a className="cover-scroll" href="#home-content" aria-label="向下浏览首页">FORMATION LAP <span aria-hidden="true"><ArrowIcon direction="down" /></span></a>
      <HomeTicker items={ticker} />
    </header>
    <ArrivalRadar/>
    <section className="home-flight-section" aria-labelledby="home-flight-heading">
      <div className="section-heading"><div><h2 id="home-flight-heading"><span>BETWEEN CITIES</span>在城市之间。</h2><p>坐过的航班，去过的机场。</p></div><a className="quiet-link" href="/flights">进入飞行日志 <ArrowIcon direction="up-right" /></a></div>
      <HomeFlights featured={featured} recent={recentFlights} airports={airports}>
        {stats.count > 0 ? <div className="home-flight-overview"><FlightCounter km={stats.totalKm} flights={stats.count} airports={stats.airports.length} airlines={stats.airlineCount} distanceCount={stats.distanceCount}/><RouteMap flights={completed} airports={airports} overview /></div> : <p className="home-flights-empty">航程正在整理，公开后会显示在这里。</p>}
      </HomeFlights>
    </section>
    {latestPhotos.length > 0 && <HomeGallery albums={latestPhotos} total={albums.length}/> }
    <section className="home-journal"><span className="kicker">LOGBOOK</span><a href="/blog"><h2>有些话，慢慢写。</h2><span>翻开航行日志</span></a>{posts.docs[0] && <a className="home-post-preview" href={`/blog/${posts.docs[0].slug}`}><TyreCompound compound={compoundFor(richTextContent(posts.docs[0].body),posts.docs[0].compound)} compact/><div><time>{posts.docs[0].date.slice(0,10).replaceAll("-", ".")}</time><h3>{posts.docs[0].title}</h3><p>{posts.docs[0].excerpt}</p></div><span>阅读</span></a>}</section>
    <section id="about" className="home-about home-about-full" aria-labelledby="home-about-heading"><div><p className="kicker">ABOUT MERAK</p><h2 id="home-about-heading">Merak，<br />也叫米拉克。</h2></div><div><p>Merak 是北斗七星里的天璇。「米拉克」就是它的音译，叫哪个都行。</p><p>试问谁又能拒绝一堆会飞的铁鸟呢。<br />至于 F1，成为 Tifosi，这辈子真是有了。</p><Comms/></div><a className="about-identity" href="/merak"><img src={imageURL('/identity/merak-avatar.webp')} width="768" height="768" alt="Merak 的蓝白狐狸角色" loading="lazy" /><span>HGH BASED / MERAK</span><strong>还有一些关于我的事 <ArrowIcon direction="up-right" /></strong></a></section>


  </HomeMotion>
}
