/** Airline designators. See docs/rebuild/AIRLINE-ASSETS.md for sources. */
const rows = [
 ['CES','MU','中国东方航空'], ['CCA','CA','中国国际航空'], ['CPA','CX','国泰航空'],
 ['CXA','MF','厦门航空'], ['SIA','SQ','新加坡航空'], ['HDA','KA','港龙航空'],
 ['QTR','QR','卡塔尔航空'], ['ANA','NH','全日空'], ['CSH','FM','上海航空'],
 ['VJC','VJ','越捷航空'], ['HVN','VN','越南航空'], ['CSN','CZ','中国南方航空'],
 ['CSC','3U','四川航空'], ['DKH','HO','吉祥航空'], ['TGW','TR','酷航'], ['UAE','EK','阿联酋航空'],
] as const
export const airlines = rows.map(([icao,iata,name]) => ({icao,iata,name}))
const lookup = new Map<string, typeof airlines[number]>(airlines.flatMap(a => [[a.icao,a],[a.iata,a]]))
export function flightIdentity(flight: {airline?: string | null; flightNumber?: string | null}) {
 const raw = (flight.flightNumber || '').replace(/\s+/g,'').toUpperCase()
 const prefix = [...lookup.keys()].sort((a,b)=>b.length-a.length).find(code => raw.startsWith(code) && /^\d+[A-Z]?$/.test(raw.slice(code.length)))
 const airline = lookup.get(prefix || (flight.airline || '').trim().toUpperCase())
 const number = prefix ? raw.slice(prefix.length) : raw
 const knownNumber = /^\d+[A-Z]?$/.test(number)
 return { airline, label: airline && knownNumber ? airline.iata + number : raw || '航班未记录',
   icao: airline && knownNumber ? airline.icao + number : undefined }
}
