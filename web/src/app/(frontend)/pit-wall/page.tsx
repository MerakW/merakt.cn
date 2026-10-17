import TerminalLogin from '@/components/TerminalLogin'
import TrackPreview from '@/components/TrackPreview'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { getHeapStatistics } from 'node:v8'
import config from '@payload-config'
import { buildAge, recordContentLatency } from '@/lib/telemetry'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'PIT WALL', description: '运行遥测与站点管理。' }
const actions = [
  ['发毛五','/manage/fursuitfriday'],['写日志','/admin/collections/posts'],['Team Radio','/admin/collections/notes'],
  ['相册','/admin/collections/albums'],['媒体库','/admin/collections/media'],['飞行记录','/admin/collections/flights'],
  ['导入 Flighty','/manage/import'],['审核留言','/admin/collections/checkins'],['站点设置','/admin/globals/site-settings'],['通行密钥','/manage/security'],
]
export default async function PitWallPage() {
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
  return <div className="pit-wall"><header className="pit-heading"><p className="kicker">MERAK / PIT WALL 51</p><div className="pit-heading-row"><h1>PIT WALL</h1>{user?<a className="pit-login" href="/admin">管理后台 ↗</a>:<a className="pit-login" href="#pit-login">管理员登录 ↓</a>}</div><div className="pit-heading-meta"><span>{local?'LOCAL / 本地预览':'SITE TELEMETRY'}</span><span>{user?'ENGINEER ACCESS':'PUBLIC VIEW'}</span></div></header><section className="telemetry-grid" aria-label="网站遥测"><article className="telemetry-battery"><p className="telemetry-label">01 / ERS · RESERVE</p><h2>运行内存余量</h2><div className="telemetry-value">{reserve}<small>%</small></div><meter min="0" max="100" value={reserve} aria-label="运行内存余量"/><div className="battery-segments" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} data-on={i<reserve/5}/>)}</div><p>{Math.round(heap.used_heap_size/1048576)} / {Math.round(heap.heap_size_limit/1048576)} MB</p><small>Node.js 堆内存 · 当前进程</small></article><article><p className="telemetry-label">02 / OT · OVERTAKE</p><h2>资源加速</h2><div className="telemetry-state" data-enabled={accelerated}>{local?'LOCAL':accelerated?'ENABLED':'STANDBY'}</div><p>{local?'本地资源直出':accelerated?'CDN Edge Caching':'缓存状态未确认'}</p><small>{local?'局域网预览':accelerated?'来源：部署缓存配置':'来源：部署配置'}</small></article><article><p className="telemetry-label">03 / TYRE AGE</p><h2>{process.env.DEPLOYED_AT?'部署寿命':'构建寿命'}</h2><div className="telemetry-value">{age??'—'}<small>LAPS / DAYS</small></div><p>{build?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(build)):'未记录构建时间'}</p><small>BUILD {(process.env.NEXT_PUBLIC_COMMIT_SHA||'LOCAL').slice(0,7).toUpperCase()}</small></article><article className="telemetry-heartbeat"><div className="heartbeat-heading"><div><p className="telemetry-label">04 / HEARTBEAT</p><h2>内容查询延迟</h2></div><span>{latency} ms / LATEST</span></div><svg viewBox="0 0 1000 180" role="img" aria-label={`最近24小时内容查询耗时，${samples.length}个样本，最高${max}毫秒`}><path className="telemetry-gridline" d="M0 30H1000 M0 95H1000 M0 160H1000"/>{samples.length>1&&<polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/>}{samples.map(s=><circle key={s.at} cx={x(s.at)} cy={160-s.ms/max*130} r="3" fill="currentColor"/>)}</svg><div className="heartbeat-axis"><span>−24 H</span><span>−12 H</span><span>NOW</span></div><p>{samples.length} 个查询样本 / 24 H</p></article></section><footer className="pit-links"><a href="https://status.merakt.cn/status/home">服务可用性 ↗</a></footer>{adminStats&&<section className="pit-admin"><h2>ENGINEER / 站点管理</h2><div className="pit-content-stats">{[['日志',adminStats[0].totalDocs,'posts'],['相册',adminStats[1].totalDocs,'albums'],['媒体',adminStats[2].totalDocs,'media'],['航班',adminStats[3].totalDocs,'flights'],['待审核留言',adminStats[4].totalDocs,'checkins']].map(([label,count,collection])=><a key={collection} href={`/admin/collections/${collection}`}><span>{label}</span><strong>{count}</strong></a>)}</div><h3>最近编辑</h3><div className="pit-recent">{adminStats[5].docs.map(post=><a key={post.id} href={`/admin/collections/posts/${post.id}`}><span>{post.title}</span><small>{post._status==='published'?'已发布':'草稿'} · {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(post.updatedAt))}</small></a>)}</div><section className="pit-actions" aria-label="管理操作">{actions.map(([label,href])=><a key={href} href={href}>{label}<span>↗</span></a>)}</section><TrackPreview/></section>}{!user&&<section id="pit-login"><TerminalLogin /></section>}</div>
}
