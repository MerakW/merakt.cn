import { flightIdentity } from './airlines'
import { flightAlliance } from './alliances'
type RecordFlight = { state: string; aircraft?: string | null; airline?: string | null; flightNumber?: string | null; date?: string | null }
export type CollectionFilter = { kind: 'family' | 'carrier'; key: string; label: string; alliance?: string }
export function aircraftFamily(aircraft?: string | null) {
 const code = (aircraft || '').toUpperCase().replace(/AIRBUS|BOEING|COMAC|[^A-Z0-9]/g, '')
 if (/^A31[89]|^A32/.test(code)) return {key:'A320',maker:'Airbus',label:'A320 family',model:'Airbus A321neo LR'}
 const match = code.match(/^(A330|A340|A350|A380|737|747|757|767|777|787|C919)/)
 if (!match) return undefined
 const key = match[1], maker = key.startsWith('A') ? 'Airbus' : key === 'C919' ? 'COMAC' : 'Boeing'
 const model: Record<string,string> = {A330:'Airbus A330-300',A340:'Airbus A340-600',A350:'Airbus A350-900',A380:'Airbus A380',737:'Boeing 737-800',747:'Boeing 747-8',777:'Boeing 777-300ER',787:'Boeing 787-9',C919:'COMAC C919'}
 return {key,maker,label:`${key} family`,model:model[key] || aircraft!}
}
export function matchesCollection(flight: RecordFlight, filter: CollectionFilter) {
 if (flight.state !== 'completed') return false
 return filter.kind === 'family' ? aircraftFamily(flight.aircraft)?.key === filter.key : flightIdentity(flight).airline?.icao === filter.key && (flightAlliance(flight)?.key || 'others') === filter.alliance
}
export function flightCollection(flights: RecordFlight[]) {
 const families = new Map<string, {key:string;maker:string;label:string;model:string;count:number}>()
 const carriers = new Map<string, {key:string;name:string;alliance:string;count:number}>()
 for (const f of flights.filter(f=>f.state === 'completed')) {
  const family = aircraftFamily(f.aircraft)
  if (family) {
   const row = families.get(family.key) || {...family,count:0}
   row.count++
   if (family.key === '737' && /MAX|7M/i.test(f.aircraft || '')) row.model='Boeing 737 MAX 8'
   families.set(family.key,row)
  }
  const airline = flightIdentity(f).airline
  if (airline) {
   const alliance = flightAlliance(f)?.key || 'others', id = `${airline.icao}:${alliance}`
   const row = carriers.get(id) || {key:airline.icao,name:airline.name,alliance,count:0}
   row.count++;carriers.set(id,row)
  }
 }
 return {families:[...families.values()].sort((a,b)=>b.count-a.count),carriers:[...carriers.values()].sort((a,b)=>b.count-a.count)}
}
