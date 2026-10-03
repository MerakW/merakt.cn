import FlightNumber from '@/components/FlightNumber'
import SpeedTunnel from '@/components/SpeedTunnel'
import HomeMotion from '@/components/HomeMotion'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getGallery } from '@/lib/gallery-server'
import { publicPhoto, safeLink } from '@/lib/gallery'
import { selectFeaturedFlight } from '@/lib/flights/public'
import { airportMap } from '@/lib/flights/airports'
import { getFlightPageData } from '@/lib/flights/page-data'

export const dynamic = 'force-dynamic'
export default async function Home() {
  const payload = await getPayload({ config })
  const [albums, settings, flights, notes, posts] = await Promise.all([
    getGallery(), payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }),
    getFlightPageData(),
    payload.find({ collection: 'notes', limit: 1, depth: 0, overrideAccess: false, sort: '-date' }),
    payload.find({ collection: 'posts', limit: 1, depth: 0, overrideAccess: false, sort: '-date' }),
  ])
  const latest = albums.find(a => !a.photos[0].video)
  const selectedAlbum = albums.find(a => a.id === (typeof settings.featuredAlbum === 'object' ? settings.featuredAlbum?.id : settings.featuredAlbum))
  const customHero = publicPhoto(settings.heroImage)
  const heroAlbum = selectedAlbum || latest
  const hero = (customHero && !customHero.video ? customHero : null) || heroAlbum?.photos.find(p => !p.video)
  const featured = selectFeaturedFlight(flights.flights)
  const intro = settings.intro || '住在杭州，喜欢航空、F1 和 Furry。平时会折腾智能家居，也经常给自己挖点新坑。'
  const latestPhotos = albums.filter(a => !a.photos[0].video && a.photos[0].id !== hero?.id).slice(0, 3)
  return <HomeMotion>
    <header className="paddock-cover">
      <SpeedTunnel />
      <div className="cover-coordinate"><span>MERAK / DIGITAL PADDOCK</span><span>HANGZHOU · 30° N / 120° E</span></div>
      <div className="cover-copy"><p className="cover-greeting">你好，叫我米拉克。</p><h1 aria-label="MERAK.">{Array.from("MERAK.").map((letter,index)=><span aria-hidden="true" key={index} style={{animationDelay:`${index * 65}ms`}}>{letter}</span>)}</h1><p className="cover-intro">{intro}</p><div className="cover-links"><a href="/merak">认识一下 <span aria-hidden="true">↗</span></a><a href="/flights">我的航程</a></div></div>
      <figure className="cover-photo">
        <a href={hero && !settings.heroImage && heroAlbum ? `/fursuitfriday?album=${heroAlbum.slug}` : '/fursuitfriday'} aria-label="查看毛五影像"><img src={hero?.display || '/identity/merak-avatar.webp'} width={hero?.width || 600} height={hero?.height || 600} alt={hero?.alt || 'Merak 的蓝白狐狸角色'} fetchPriority="high" /></a>
        <figcaption><span>另一面的我 / FURSUITFRIDAY</span>{hero?.credit && <span>摄影 {hero.credit}</span>}</figcaption>
      </figure>
      <div className="cover-bottom"><span>航空 / F1 / FURRY</span><span>生活还在继续，偶尔在这里存个档。</span></div>
    </header>
    <section className="lounge-invite"><div><p className="kicker">THE WAITING ROOM · 欢迎登机</p><h2>给你留了一个靠窗的位置。</h2><p>从你的城市出发，领一张写着你名字的登机牌。杭州见。</p></div><a href="/visitors"><span className="invite-route" aria-hidden="true">YOU <i>→</i> HGH</span><span>领取我的登机牌 ↗</span></a></section>
    <section className="home-flight" aria-labelledby="home-flight-heading"><div><p className="kicker">FLIGHT LOG</p><h2 id="home-flight-heading">飞行记录</h2><p>坐过的航班，去过的机场。</p><a className="quiet-link" href="/flights">查看航程</a></div>{featured ? <a className="home-flight-route" href="/flights"><span>{featured.kind === 'upcoming' ? '下一次出发' : '最近一次抵达'} · {featured.flight.date.replaceAll('-', '.')}</span><strong>{featured.flight.from}<i className="home-route-connector" aria-hidden="true" />{featured.flight.to}</strong><span className="home-flight-number"><FlightNumber flight={featured.flight} /></span><span>{airportMap.get(featured.flight.from)?.city} · {airportMap.get(featured.flight.to)?.city}</span></a> : <div className="home-flight-note"><span className="home-route-line" aria-hidden="true">HGH <i>✈</i></span><p>航程正在整理。<br /><span>公开后会显示在这里。</span></p></div>}</section>
    {latestPhotos.length > 0 && <section className="home-photos" aria-labelledby="home-photos-heading"><div className="section-heading"><div><p className="kicker">FURSUITFRIDAY</p><h2 id="home-photos-heading">最近的毛五</h2></div><a className="quiet-link" href="/fursuitfriday">全部影像</a></div><div className="home-photo-strip">{latestPhotos.map(album => <a key={album.id} href={`/fursuitfriday?album=${album.slug}`}><img src={album.photos[0].thumbnail} srcSet={album.photos[0].srcSet} sizes="(max-width:600px) 90vw, 30vw" width={album.photos[0].width} height={album.photos[0].height} alt={album.photos[0].alt} loading="lazy" /><time>{album.date.replaceAll('-', '.')}</time><p>{album.title}</p>{album.photos[0].credit && <span className="home-photo-credit">摄影 {album.photos[0].credit}</span>}</a>)}</div></section>}
    <section className="home-journal"><span className="kicker">LOGBOOK</span><a href="/blog"><h2>有些话，慢慢写。</h2><span>翻开航行日志</span></a>{posts.docs[0] && <a className="home-post-preview" href={`/blog/${posts.docs[0].slug}`}><div><time>{posts.docs[0].date.slice(0,10).replaceAll("-", ".")}</time><h3>{posts.docs[0].title}</h3><p>{posts.docs[0].excerpt}</p></div><span>阅读</span></a>}</section>
    <section id="about" className="home-about home-about-full" aria-labelledby="home-about-heading"><div><p className="kicker">ABOUT MERAK</p><h2 id="home-about-heading">Merak，<br />也叫米拉克。</h2></div><div><p>Merak 是北斗七星里的天璇。「米拉克」就是它的音译，叫哪个都行。</p><p>试问谁又能拒绝一堆会飞的铁鸟呢。<br />至于 F1，成为 Tifosi，这辈子真是有了。</p><div className="home-socials"><a href="https://qm.qq.com/cgi-bin/qm/qr?k=1540180211">QQ · 1540180211</a><a href="https://github.com/MerakW">GitHub · MerakW</a><a href="https://v.douyin.com/9FjfikdKPog">抖音 · @merak_w</a></div></div><a className="about-identity" href="/merak"><img src="/identity/merak-avatar.webp" width="768" height="768" alt="Merak 的蓝白狐狸角色" loading="lazy" /><span>HGH BASED / MERAK</span><strong>还有一些关于我的事 ↗</strong></a></section>
    {notes.docs[0] && <section className="home-note" aria-label="近况"><p className="kicker">最近在干嘛 · {notes.docs[0].date.slice(0, 10).replaceAll('-', '.')}</p><p>{notes.docs[0].text}</p>{safeLink(notes.docs[0].link) && <a className="quiet-link" href={safeLink(notes.docs[0].link)}>相关链接</a>}</section>}

  </HomeMotion>
}
