import { translatedPost } from '@/lib/i18n/content'
import { getLocale } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
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
import LoadingImage from '@/components/LoadingImage'
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
    getGallery(await getLocale()), payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }),
    getFlightPageData(),
    payload.find({ collection: 'posts', limit: 1, depth: 0, overrideAccess: false, sort: '-date' }),
  ])
  const locale = await getLocale()
  posts.docs = posts.docs.map(post => translatedPost(post, locale))
  const latest = albums.find(a => !a.photos[0].video)
  const selectedAlbum = albums.find(a => a.id === (typeof settings.featuredAlbum === 'object' ? settings.featuredAlbum?.id : settings.featuredAlbum))
  const customHero = publicPhoto(settings.heroImage)
  const heroAlbum = selectedAlbum || latest
  const hero = (customHero && !customHero.video ? customHero : null) || heroAlbum?.photos.find(p => !p.video)
  const featured = selectFeaturedFlight(flights.flights)
  const intro = "@i18n:home.intro@"
  const visibleFlights = flights.flights.filter(flight => isFlightPublic(flight)).map(publicFlight)
  const completed = visibleFlights.filter(flight => flight.state === 'completed')
  const usedCodes = new Set(visibleFlights.flatMap(flight => [flight.from, flight.to, flight.divertedTo].filter(Boolean) as string[]))
  const airports = [...usedCodes].flatMap(code => airportMap.has(code) ? [airportMap.get(code)!] : [])
  const stats = flightSouvenirs(visibleFlights, airports)
  const recentFlights = [...completed].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4)
  const ticker = ['HGH 30°N 120°E', "@i18n:ui.aviationF1Furry@", `${stats.count} FLIGHTS LOGGED`, `${Math.round(stats.totalKm).toLocaleString('en-US')} KM · EST.`, `${albums.length} FURSUIT FRIDAYS`, "@i18n:ui.alwaysMovingForward@", 'DIGITAL PADDOCK']
  const latestPhotos = albums.filter(a => !a.photos[0].video && a.photos[0].id !== hero?.id).slice(0, 12)
  return <Localized><HomeMotion>
    <header className="paddock-cover">
      <SpeedTunnel />
      <div className="cover-coordinate"><span>MERAK / DIGITAL PADDOCK</span><span>HANGZHOU · 30° N / 120° E</span></div>
      <div className="cover-copy"><p className="cover-greeting">{"@i18n:home.greeting@"}</p><p className="cover-intro">{intro}</p><div className="cover-links"><a href="/merak">{"@i18n:home.meet@ "}<span aria-hidden="true"><ArrowIcon direction="up-right" /></span></a><a href="/flights">{"@i18n:home.flights@"}</a></div></div>
      <figure className="cover-photo">
        <a href={hero && !settings.heroImage && heroAlbum ? `/fursuitfriday?album=${heroAlbum.slug}` : '/fursuitfriday'} aria-label="@i18n:ui.viewFursuitFridayPhotos@"><LoadingImage src={hero?.display || imageURL('/identity/merak-avatar.webp')} width={hero?.width || 600} height={hero?.height || 600} alt={hero?.alt || "@i18n:ui.meraksBlueAndWhiteFoxCharacter@"} fetchPriority="high" /></a>
        <figcaption><span>{"@i18n:ui.anotherSideOfMeFursuitFriday@"}</span>{hero?.credit && <span>{"@i18n:ui.photoBy@ "}{hero.credit}</span>}</figcaption>
      </figure>
      <h1 className="cover-wordmark" aria-label="MERAK.">{Array.from('MERAK.').map((letter,index)=><span aria-hidden="true" key={index} style={{animationDelay:`${index * 65}ms`}}>{letter}</span>)}</h1>
      <a className="cover-scroll" href="#home-content" aria-label="@i18n:ui.scrollDown@">FORMATION LAP <span aria-hidden="true"><ArrowIcon direction="down" /></span></a>
      <HomeTicker items={ticker} />
    </header>
    <ArrivalRadar/>
    <section className="home-flight-section" aria-labelledby="home-flight-heading">
      <div className="section-heading"><div><h2 id="home-flight-heading"><span>BETWEEN CITIES</span>{"@i18n:home.betweenCities@"}</h2><p>{"@i18n:home.flightDescription@"}</p></div><a className="quiet-link" href="/flights">{"@i18n:ui.exploreTheFlightLog@ "}<ArrowIcon direction="up-right" /></a></div>
      <HomeFlights featured={featured} recent={recentFlights} airports={airports}>
        {stats.count > 0 ? <div className="home-flight-overview"><FlightCounter km={stats.totalKm} flights={stats.count} airports={stats.airports.length} airlines={stats.airlineCount} distanceCount={stats.distanceCount}/><RouteMap flights={completed} airports={airports} overview /></div> : <p className="home-flights-empty">{"@i18n:ui.flightsAreBeingOrganizedTheyWillAppearHere@"}</p>}
      </HomeFlights>
    </section>
    {latestPhotos.length > 0 && <HomeGallery albums={latestPhotos} total={albums.length}/> }
    <section className="home-journal"><span className="kicker">LOGBOOK</span><a href="/blog"><h2>{"@i18n:home.journalHeading@"}</h2><span>{"@i18n:home.openJournal@"}</span></a>{posts.docs[0] && <a className="home-post-preview" href={`/blog/${posts.docs[0].slug}`}><TyreCompound compound={compoundFor(richTextContent(posts.docs[0].body),posts.docs[0].compound)} compact/><div><time>{posts.docs[0].date.slice(0,10).replaceAll("-", ".")}</time><h3 data-i18n="off">{posts.docs[0].title}</h3><p data-i18n="off">{posts.docs[0].excerpt}</p></div><span>{"@i18n:ui.read2@"}</span></a>}</section>
    <section id="about" className="home-about home-about-full" aria-labelledby="home-about-heading"><div><p className="kicker">ABOUT MERAK</p><h2 id="home-about-heading">Merak，<br />{"@i18n:home.alsoKnownAs@"}</h2></div><div><p>{"@i18n:profile.originText@"}</p><p>{"@i18n:ui.whoCouldResistASkyFullOfMetal@"}<br />{"@i18n:ui.andF1LifeAsATifosiIsQuite@"}</p><Comms/></div><a className="about-identity" href="/merak"><img src={imageURL('/identity/merak-avatar.webp')} width="768" height="768" alt="@i18n:ui.meraksBlueAndWhiteFoxCharacter@" loading="lazy" /><span>HGH BASED / MERAK</span><strong>{"@i18n:ui.aLittleMoreAboutMe@ "}<ArrowIcon direction="up-right" /></strong></a></section>


  </HomeMotion></Localized>
}
