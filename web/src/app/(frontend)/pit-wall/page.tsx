import { message as i18nMessage } from '@/lib/i18n/core'
import { translatedMetadata } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import LightsOut from '@/components/LightsOut'
import TerminalLogin from '@/components/TerminalLogin'
import TrackPreview from '@/components/TrackPreview'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { getHeapStatistics } from 'node:v8'
import config from '@payload-config'
import { buildAge, recordContentLatency } from '@/lib/telemetry'
export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: 'PIT WALL', description: "@i18n:ui.siteTelemetryAndAdministration@" }) }
const actions = [
  ["@i18n:admin.maintenance.title@",'/manage/maintenance'],
  ["@i18n:ui.paddockInteractions@",'/admin/collections/paddock-signals'],["@i18n:ui.postPhotos@",'/manage/fursuitfriday'],["@i18n:ui.writeAPost@",'/admin/collections/posts'],['Team Radio','/admin/collections/notes'],
  ["@i18n:ui.albums@",'/admin/collections/albums'],["@i18n:ui.mediaLibrary@",'/admin/collections/media'],["@i18n:flights.title@",'/admin/collections/flights'],
  ["@i18n:ui.importFlighty@",'/manage/import'],["@i18n:ui.reviewMessages@",'/admin/collections/checkins'],["@i18n:ui.siteSettings@",'/admin/globals/site-settings'],["@i18n:ui.passkeys@",'/manage/security'],
]
export default async function PitWallPage() {
  const locale = await getLocale()
  const payload = await getPayload({config})
  const { user } = await payload.auth({headers:await headers()})
  const adminStats = user ? await Promise.all([
    payload.count({collection:'posts',overrideAccess:false,user}),
    payload.count({collection:'albums',overrideAccess:false,user}),
    payload.count({collection:'media',overrideAccess:false,user}),
    payload.count({collection:'flights',overrideAccess:false,user}),
    payload.count({collection:'checkins',where:{status:{equals:'pending'}},overrideAccess:false,user}),
    payload.find({collection:'posts',sort:'-updatedAt',limit:5,depth:0,draft:true,overrideAccess:false,user}),
  ]) : null
  const started = performance.now()
  await payload.count({collection:'posts',overrideAccess:false})
  const latency = Math.round((performance.now()-started)*10)/10
  const samples = await recordContentLatency(latency)
  const heap = getHeapStatistics()
  const reserve = Math.max(0,Math.min(100,Math.round((1-heap.used_heap_size/heap.heap_size_limit)*100)))
  const build = process.env.DEPLOYED_AT || process.env.NEXT_PUBLIC_BUILD_AT
  const age = buildAge(build)
  const local = process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1'
  const accelerated = !local && process.env.CDN_EDGE_CACHE_ACTIVE === 'true'
  const max = Math.max(1,...samples.map(s=>s.ms))
  const now = Date.now()
  const x = (at:string) => ((Date.parse(at)-(now-86400000))/86400000)*1000
  const points = samples.map(s=>`${x(s.at)},${160-s.ms/max*130}`).join(' ')
  return <Localized><div className="pit-wall"><header className="pit-heading"><p className="kicker">MERAK / PIT WALL 51</p><div className="pit-heading-row"><h1>PIT WALL</h1>{user?<a className="pit-login" href="/admin">{"@i18n:ui.adminPanel@ "}<ArrowIcon direction="up-right"/></a>:<a className="pit-login" href="#pit-login">{"@i18n:ui.administratorSignIn@ "}<ArrowIcon direction="down"/></a>}</div><div className="pit-heading-meta"><span>{local?"@i18n:ui.localPreview@":'SITE TELEMETRY'}</span><span>{user?'ENGINEER ACCESS':'PUBLIC VIEW'}</span></div></header><LightsOut/><section className="telemetry-grid" aria-label="@i18n:ui.siteTelemetry@"><article className="telemetry-battery"><p className="telemetry-label">01 / ERS · RESERVE</p><h2>{"@i18n:ui.memoryHeadroom@"}</h2><div className="telemetry-value">{reserve}<small>%</small></div><meter min="0" max="100" value={reserve} aria-label="@i18n:ui.memoryHeadroom@"/><div className="battery-segments" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} data-on={i<reserve/5}/>)}</div><p>{Math.round(heap.used_heap_size/1048576)} / {Math.round(heap.heap_size_limit/1048576)} MB</p><small>{"@i18n:ui.nodeJsHeapCurrentProcess@"}</small></article><article><p className="telemetry-label">02 / OT · OVERTAKE</p><h2>{"@i18n:ui.assetAcceleration@"}</h2><div className="telemetry-state" data-enabled={accelerated}>{local?'LOCAL':accelerated?'ENABLED':'STANDBY'}</div><p>{local?"@i18n:ui.assetsServedLocally@":accelerated?'CDN Edge Caching':"@i18n:ui.cacheStateUnconfirmed@"}</p><small>{local?"@i18n:ui.lanPreview@":accelerated?"@i18n:ui.sourceDeploymentCacheConfiguration@":"@i18n:ui.sourceDeploymentConfiguration@"}</small></article><article><p className="telemetry-label">03 / TYRE AGE</p><h2>{process.env.DEPLOYED_AT?"@i18n:ui.deploymentAge@":"@i18n:ui.buildAge@"}</h2><div className="telemetry-value">{age??'—'}<small>LAPS / DAYS</small></div><p>{build?new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(build)):"@i18n:ui.buildTimeNotRecorded@"}</p><small>BUILD {(process.env.NEXT_PUBLIC_COMMIT_SHA||'LOCAL').slice(0,7).toUpperCase()}</small></article><article className="telemetry-heartbeat"><div className="heartbeat-heading"><div><p className="telemetry-label">04 / HEARTBEAT</p><h2>{"@i18n:ui.contentQueryLatency@"}</h2></div><span>{latency} ms / LATEST</span></div><svg viewBox="0 0 1000 180" role="img" aria-label={i18nMessage('ui.contentQueryTimesOver24HoursValue0Samples', samples.length, max)}><path className="telemetry-gridline" d="M0 30H1000 M0 95H1000 M0 160H1000"/>{samples.length>1&&<polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/>}{samples.map(s=><circle key={s.at} cx={x(s.at)} cy={160-s.ms/max*130} r="3" fill="currentColor"/>)}</svg><div className="heartbeat-axis"><span>−24 H</span><span>−12 H</span><span>NOW</span></div><p>{samples.length} {" @i18n:ui.querySamples24H@"}</p></article></section><footer className="pit-links"><a href="https://status.merakt.cn/status/home">{"@i18n:ui.serviceAvailability@ "}<ArrowIcon direction="up-right"/></a></footer>{adminStats&&<section className="pit-admin"><h2>{"@i18n:ui.engineerSiteManagement@"}</h2><div className="pit-content-stats">{[["@i18n:nav.journal@",adminStats[0].totalDocs,'posts'],["@i18n:ui.albums@",adminStats[1].totalDocs,'albums'],["@i18n:ui.media@",adminStats[2].totalDocs,'media'],["@i18n:ui.flight2@",adminStats[3].totalDocs,'flights'],["@i18n:ui.pendingMessages@",adminStats[4].totalDocs,'checkins']].map(([label,count,collection])=><a key={collection} href={`/admin/collections/${collection}`}><span>{label}</span><strong>{count}</strong></a>)}</div><h3>{"@i18n:ui.recentlyEdited@"}</h3><div className="pit-recent">{adminStats[5].docs.map(post=><a key={post.id} href={`/admin/collections/posts/${post.id}`}><span data-i18n="off">{post.title}</span><small>{post._status==='published'?"@i18n:ui.published2@":"@i18n:ui.draft@"} · {new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(post.updatedAt))}</small></a>)}</div><section className="pit-actions" aria-label="@i18n:ui.managementActions@">{actions.map(([label,href])=><a key={href} href={href}>{label}<ArrowIcon direction="up-right"/></a>)}</section><TrackPreview/></section>}{!user&&<section id="pit-login"><TerminalLogin /></section>}</div></Localized>
}
