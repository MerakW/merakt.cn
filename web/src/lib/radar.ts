import { airports, airportMap } from './flights/airports'
import scheduledData from '../data/radar-airports.json'

const scheduled = new Set(scheduledData.scheduled)
const candidates = airports.filter(airport => scheduled.has(airport.iata))

// A coarse IP fix cannot identify the visitor's actual departure airport.
// Defaults represent each metro; explicit choices always bypass this policy.
const metros = [
  { city: 'Beijing', airports: ['PEK', 'PKX'] },
  { city: 'Taipei', airports: ['TPE', 'TSA'] },
  { city: 'Singapore', airports: ['SIN', 'XSP'] },
  { city: 'Shanghai', airports: ['PVG', 'SHA'] },
  { city: 'Tokyo', airports: ['HND', 'NRT'] },
  { city: 'Osaka', airports: ['KIX', 'ITM', 'UKB'] },
  { city: 'Seoul', airports: ['ICN', 'GMP'] },
  { city: 'Bangkok', airports: ['BKK', 'DMK'] },
  { city: 'London', airports: ['LHR', 'LGW', 'LCY', 'LTN', 'STN', 'SEN'] },
  { city: 'Paris', airports: ['CDG', 'ORY'] },
  { city: 'New York', airports: ['JFK', 'EWR', 'LGA'] },
  { city: 'Rome', airports: ['FCO', 'CIA'] },
  { city: 'Milan', airports: ['MXP', 'LIN', 'BGY'] },
  { city: 'Istanbul', airports: ['IST', 'SAW'] },
  { city: 'Jakarta', airports: ['CGK', 'HLP'] },
]

export function distanceKm(lat: number, lon: number, toLat: number, toLon: number) {
  const r = Math.PI / 180
  const s = Math.sin((toLat-lat)*r/2)**2 + Math.cos(lat*r)*Math.cos(toLat*r)*Math.sin((toLon-lon)*r/2)**2
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1-s)))
}

export function radarRoute({ lat, lon, code, city }: { lat?: number; lon?: number; code?: string; city?: string }) {
  const automatic = code === undefined
  if (automatic && (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) return null
  let airport = automatic
    ? candidates.reduce((best, next) => distanceKm(lat!, lon!, next.latitude, next.longitude) < distanceKm(lat!, lon!, best.latitude, best.longitude) ? next : best)
    : airportMap.get(code.trim().toUpperCase())
  if (!airport) return null
  const metro = metros.find(metro => metro.airports.includes(airport!.iata))
  const primary = metro && airportMap.get(metro.airports[0])
  // Bound recommendations to the metro area, including secondary airports;
  // never jump to another country or a distant hub just for its size.
  const normalizeCity = (name: string) => name.toLowerCase().replace(/\b(city|shi)\b/g, '').replace(/[\s-]+/g, '')
  const sameCity = !city || (metro && normalizeCity(city) === normalizeCity(metro.city))
  const useMetro = sameCity && automatic && primary && scheduled.has(primary.iata) && primary.country === airport.country && distanceKm(lat!, lon!, primary.latitude, primary.longitude) <= 120
  if (useMetro) airport = primary
  const rawKm = distanceKm(automatic ? lat! : airport.latitude, automatic ? lon! : airport.longitude, 30.2741, 120.1551)
  return {
    city: useMetro ? metro!.city : airport.city,
    airport: airport.iata,
    airports: metro && (!automatic || useMetro) ? metro.airports.filter(code => scheduled.has(code) && airportMap.has(code)) : [airport.iata],
    automatic,
    local: rawKm < 50,
    km: Math.round(rawKm / 10) * 10,
    minutes: Math.round((rawKm / 900 * 60 + 60) / 5) * 5,
  }
}
