'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized, { useLocale } from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'

import { imageURL, airlineLogoURL } from '@/lib/assets'
import { useMemo, useState, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { DisplayFlight } from './FlightBoard'
import AircraftPortrait from './AircraftPortrait'
import ArchiveTabs from './ArchiveTabs'
import { flightCollection, type CollectionFilter } from '@/lib/flights/collection'
const alliances = [{key:'skyteam',name:"@i18n:ui.skyteam@"},{key:'star',name:"@i18n:ui.starAlliance@"},{key:'oneworld',name:"@i18n:ui.oneworld@"},{key:'others',name:"@i18n:ui.otherAirlines@"}]
export default function FlightCollection({flights,children,onSelect,selected}: {flights:DisplayFlight[];children:ReactNode;onSelect:(filter:CollectionFilter)=>void;selected:CollectionFilter|null}) {
 const locale = useLocale()
 const [module,setModule] = useState<'airports'|'aircraft'|'airlines'>('aircraft')
 const [maker,setMaker] = useState('all'), [alliance,setAlliance] = useState('all')
 const filterRef=useRef<HTMLDivElement>(null)
 useLayoutEffect(()=>{
  const root=filterRef.current;if(!root)return
  const update=()=>{const selected=root.querySelector<HTMLElement>('[aria-pressed="true"]');if(selected){root.style.setProperty('--filter-x',`${selected.offsetLeft}px`);root.style.setProperty('--filter-y',`${selected.offsetTop+selected.offsetHeight+11}px`);root.style.setProperty('--filter-width',`${selected.offsetWidth}px`)}}
  update();const observer=new ResizeObserver(update);observer.observe(root);return()=>observer.disconnect()
 },[module,maker,alliance,locale])
 const data = useMemo(()=>flightCollection(flights),[flights])
 return <Localized><section className="flight-collection" aria-label="@i18n:ui.flightCollection@">
  <ArchiveTabs className="collection-modules archive-view" label="@i18n:ui.collectionCategories@" value={module} onChange={setModule} options={[{value:'airports',label:"@i18n:ui.airports2@"},{value:'aircraft',label:"@i18n:ui.aircraft2@"},{value:'airlines',label:"@i18n:ui.airlines@"}]} />
  <div className="collection-module-stage" key={module}>{module === 'airports' ? children : <div className="collection-panel">
   <div className="stampbook-heading"><div><p className="kicker">{module === 'aircraft' ? 'AIRCRAFT FAMILIES' : 'AIRLINES'}</p><h2>{module === 'aircraft' ? "@i18n:ui.aircraftFlown@" : "@i18n:ui.airlinesFlown@"}</h2></div><p>{module === 'aircraft' ? i18nMessage('ui.value0AircraftFamilies', data.families.length) : i18nMessage('ui.value0Airlines', new Set(data.carriers.map(c=>c.key)).size)}<span>{"@i18n:ui.selectToFilterFlights@"}</span></p></div>
   <div ref={filterRef} className="collection-filters" role="group" aria-label={module === 'aircraft' ? "@i18n:ui.manufacturer@" : "@i18n:ui.airlineAlliance@"}>
    <button aria-pressed={(module === 'aircraft' ? maker : alliance) === 'all'} onClick={()=>module === 'aircraft' ? setMaker('all') : setAlliance('all')}>{"@i18n:common.all@"}</button>
    {module === 'aircraft' ? ['Airbus','Boeing','COMAC'].map(name=><button key={name} aria-label={name} aria-pressed={maker===name} onClick={()=>setMaker(name)}><img src={imageURL(`/collection-logos/${name}.svg`)} alt={name}/></button>) : alliances.map(a=><button key={a.key} aria-label={a.name} aria-pressed={alliance===a.key} onClick={()=>setAlliance(a.key)}>{a.key === 'others' ? <><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18"/></svg><span>{"@i18n:ui.other@"}</span></> : a.key === 'star' ? <><img className="theme-logo-light" src={imageURL('/collection-logos/star-wide.svg')} alt={a.name}/><img className="theme-logo-dark" src={imageURL('/collection-logos/star-wide-dark.svg')} alt={a.name}/></> : <img src={imageURL(`/collection-logos/${a.key}.svg`)} alt={a.name}/>}</button>)}
    <span className="collection-filter-marker" aria-hidden="true" />
   </div>
   <div key={`${module}-${maker}-${alliance}`} className={`collection-grid collection-${module}`}>
    {module === 'aircraft' ? data.families.filter(f=>maker==='all'||f.maker===maker).map(f=><button className="collection-item" key={f.key} aria-pressed={selected?.kind==='family'&&selected.key===f.key} onClick={()=>onSelect({kind:'family',key:f.key,label:f.label})}><span className="collection-item-head"><span>{f.maker}</span><small>FAMILY / {f.key}</small></span><span className="collection-family-code" aria-hidden="true">{f.key}</span><AircraftPortrait flight={{aircraft:f.model}}/><span className="collection-item-foot"><span>{f.label}</span><span><b>{f.count}</b> {" @i18n:ui.flights@ "}<i aria-hidden="true"><ArrowIcon direction="up-right" /></i></span></span></button>) : data.carriers.filter(c=>alliance==='all'||c.alliance===alliance).map(c=><button className="collection-item" key={`${c.key}:${c.alliance}`} aria-pressed={selected?.kind==='carrier'&&selected.key===c.key&&selected.alliance===c.alliance} onClick={()=>onSelect({kind:'carrier',key:c.key,label:c.name,alliance:c.alliance})}><span className="collection-carrier-code" aria-hidden="true">{c.key}</span><img className="collection-carrier-logo" src={airlineLogoURL(c.key)} alt=""/><strong>{c.name}</strong><span className="collection-carrier-alliance">{c.key === 'CXA' && c.alliance === 'others' ? "@i18n:ui.flightsBeforeJoiningSkyteam@" : alliances.find(a=>a.key===c.alliance)?.name}</span><span className="collection-item-foot"><span><b>{c.count}</b> {" @i18n:ui.flights2@"}</span><span aria-hidden="true"><ArrowIcon direction="up-right" /></span></span></button>)}
   </div>
   {module==='airlines' && !data.carriers.some(c=>alliance==='all'||c.alliance===alliance) && <p className="empty-list">{"@i18n:ui.noFlightsWithTheseAirlinesYet@"}</p>}
   <p className="collection-note">{module==='aircraft' ? "@i18n:ui.basedOnAircraftFamiliesOfCompletedFlightsModels@" : "@i18n:ui.groupedByAllianceAtTheTimeOfTravel@"}</p>
  </div>}</div>
 </section></Localized>
}
