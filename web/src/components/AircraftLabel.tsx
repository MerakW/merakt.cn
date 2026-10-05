import { imageURL } from '@/lib/assets'
const airbus = new Set(['A319','A320','A320-200','A320neo','A321','A321-200','A321neo','A330','A330-200','A330-300','A340-600','A350','A350-900','A380'])
const boeing = new Set(['737','737-700','737-800','737-MAX','737-MAX-8','747-400','747-8','777','777-300ER','787-8','787-9','787-10','787-Dreamliner'])
export default function AircraftLabel({ aircraft, light = false, compact = false }: { aircraft?: string | null; light?: boolean; compact?: boolean }) {
 const name = aircraft?.trim() || '机型未记录'
 const airbusCode = name.replace(/^Airbus\s+/i, '')
 const code = /^A340[-\s]?600$/i.test(airbusCode) ? 'A340-600' : airbusCode
 const boeingCode = name.replace(/^Boeing\s+/i, '').replace(/\s+/g, '-')
 let logo: string | undefined
 if (airbus.has(code)) logo = `AIRBUS-${code}`
 else if (boeing.has(boeingCode)) logo = `BOEING-${boeingCode}`
 else if (/^Boeing 737/i.test(name)) logo = /MAX/i.test(name) ? 'BOEING-737-MAX' : 'BOEING-737'
 else if (/^Boeing 787/i.test(name)) logo = 'BOEING-787-Dreamliner'
 else if (/^Boeing 777/i.test(name)) logo = 'BOEING-777'
 else if (/C919/i.test(name)) logo = 'COMAC-C919'
 const file = compact || logo === 'AIRBUS-A340-600' ? logo?.replace(/^(AIRBUS|BOEING|COMAC)-/, '') : logo
 return logo ? <img className={`aircraft-type-logo${logo.startsWith('BOEING') ? ' aircraft-type-boeing' : ''}${logo.startsWith('BOEING-787') ? ' aircraft-type-dreamliner' : ''}`} src={imageURL(`/aircraft-logos-v4/${compact ? 'short' : 'word-only'}/${light ? 'white' : 'black'}/${file}.svg`)} alt={name} title={name} /> : <span>{name}</span>
}
