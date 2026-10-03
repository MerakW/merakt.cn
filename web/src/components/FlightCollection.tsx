'use client'
import { useMemo, useState, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { DisplayFlight } from './FlightBoard'
import AircraftPortrait from './AircraftPortrait'
import ArchiveTabs from './ArchiveTabs'
import { flightCollection, type CollectionFilter } from '@/lib/flights/collection'
const alliances = [{key:'skyteam',name:'天合联盟'},{key:'star',name:'星空联盟'},{key:'oneworld',name:'寰宇一家'},{key:'others',name:'其他航司'}]
export default function FlightCollection({flights,children,onSelect,selected}: {flights:DisplayFlight[];children:ReactNode;onSelect:(filter:CollectionFilter)=>void;selected:CollectionFilter|null}) {
 const [module,setModule] = useState<'airports'|'aircraft'|'airlines'>('airports')
 const [maker,setMaker] = useState('all'), [alliance,setAlliance] = useState('all')
 const filterRef=useRef<HTMLDivElement>(null)
 useLayoutEffect(()=>{
  const root=filterRef.current;if(!root)return
  const update=()=>{const selected=root.querySelector<HTMLElement>('[aria-pressed="true"]');if(selected){root.style.setProperty('--filter-x',`${selected.offsetLeft}px`);root.style.setProperty('--filter-y',`${selected.offsetTop+selected.offsetHeight+11}px`);root.style.setProperty('--filter-width',`${selected.offsetWidth}px`)}}
  update();const observer=new ResizeObserver(update);observer.observe(root);return()=>observer.disconnect()
 },[module,maker,alliance])
 const data = useMemo(()=>flightCollection(flights),[flights])
 return <section className="flight-collection" aria-label="飞行收藏">
  <ArchiveTabs className="collection-modules archive-view" label="收藏分类" value={module} onChange={setModule} options={[{value:'airports',label:'机场'},{value:'aircraft',label:'机型'},{value:'airlines',label:'航司'}]} />
  <div className="collection-module-stage" key={module}>{module === 'airports' ? children : <div className="collection-panel">
   <div className="stampbook-heading"><div><p className="kicker">{module === 'aircraft' ? 'AIRCRAFT FAMILIES' : 'AIRLINES'}</p><h2>{module === 'aircraft' ? '搭乘过的机型' : '搭乘过的航司'}</h2></div><p>{module === 'aircraft' ? `${data.families.length} 个机型家族` : `${new Set(data.carriers.map(c=>c.key)).size} 家航司`}<span>点击筛选航程</span></p></div>
   <div ref={filterRef} className="collection-filters" role="group" aria-label={module === 'aircraft' ? '飞机厂商' : '航空联盟'}>
    <button aria-pressed={(module === 'aircraft' ? maker : alliance) === 'all'} onClick={()=>module === 'aircraft' ? setMaker('all') : setAlliance('all')}>全部</button>
    {module === 'aircraft' ? ['Airbus','Boeing','COMAC'].map(name=><button key={name} aria-label={name} aria-pressed={maker===name} onClick={()=>setMaker(name)}><img src={`/collection-logos/${name}.svg`} alt={name}/></button>) : alliances.map(a=><button key={a.key} aria-label={a.name} aria-pressed={alliance===a.key} onClick={()=>setAlliance(a.key)}>{a.key === 'others' ? <><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18"/></svg><span>其他</span></> : a.key === 'star' ? <><img className="theme-logo-light" src="/collection-logos/star-wide.svg" alt={a.name}/><img className="theme-logo-dark" src="/collection-logos/star-wide-dark.svg" alt={a.name}/></> : <img src={`/collection-logos/${a.key}.svg`} alt={a.name}/>}</button>)}
    <span className="collection-filter-marker" aria-hidden="true" />
   </div>
   <div key={`${module}-${maker}-${alliance}`} className={`collection-grid collection-${module}`}>
    {module === 'aircraft' ? data.families.filter(f=>maker==='all'||f.maker===maker).map(f=><button className="collection-item" key={f.key} aria-pressed={selected?.kind==='family'&&selected.key===f.key} onClick={()=>onSelect({kind:'family',key:f.key,label:f.label})}><span className="collection-item-head"><span>{f.maker}</span><small>FAMILY / {f.key}</small></span><span className="collection-family-code" aria-hidden="true">{f.key}</span><AircraftPortrait flight={{aircraft:f.model}}/><span className="collection-item-foot"><span>{f.label}</span><span><b>{f.count}</b> 段 <i aria-hidden="true">↗</i></span></span></button>) : data.carriers.filter(c=>alliance==='all'||c.alliance===alliance).map(c=><button className="collection-item" key={`${c.key}:${c.alliance}`} aria-pressed={selected?.kind==='carrier'&&selected.key===c.key&&selected.alliance===c.alliance} onClick={()=>onSelect({kind:'carrier',key:c.key,label:c.name,alliance:c.alliance})}><span className="collection-carrier-code" aria-hidden="true">{c.key}</span><img className="collection-carrier-logo" src={`/airlines/${c.key==='ANA'?'ANA-symbol.svg':`${c.key}.${c.key==='HDA'?'svg':'png'}`}`} alt=""/><strong>{c.name}</strong><span className="collection-carrier-alliance">{c.key === 'CXA' && c.alliance === 'others' ? '加入天合联盟前的飞行' : alliances.find(a=>a.key===c.alliance)?.name}</span><span className="collection-item-foot"><span><b>{c.count}</b> 段飞行</span><span aria-hidden="true">↗</span></span></button>)}
   </div>
   {module==='airlines' && !data.carriers.some(c=>alliance==='all'||c.alliance===alliance) && <p className="empty-list">暂无这类航司的飞行记录。</p>}
   <p className="collection-note">{module==='aircraft' ? '按已完成航班的机型家族统计；机模展示代表型号。' : '按飞行时的联盟归属整理，包含联盟伙伴及历史成员。'}</p>
  </div>}</div>
 </section>
}
