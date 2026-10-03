import { formatRegistration } from './registration'
import { flightIdentity } from './airlines'
import type { publicFlight } from './public'
import type { Airport } from './types'

type Flight = ReturnType<typeof publicFlight>
export const landingAirport = (f: Flight) => f.divertedTo || f.to
export const routeKey = (f: Flight) => [f.from, landingAirport(f)].sort().join('–')

/** Great-circle endpoint distance, not flown mileage. */
export function endpointDistance(a?: Airport, b?: Airport): number | null {
  if (!a || !b || ![a, b].every(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180)) return null
  const rad = Math.PI / 180
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

export function flightSouvenirs(flights: Flight[], airports: Airport[]) {
  const completed = flights.filter(f => f.state === 'completed').sort((a, b) => (a.departureUTC || a.date).localeCompare(b.departureUTC || b.date))
  const index = new Map(airports.map(a => [a.iata, a]))
  const visits = new Map<string, number>()
  const firstVisits = new Map<string, string>()
  let totalKm = 0
  let distanceCount = 0
  const routes = new Map<string, { key: string; from: string; to: string; count: number }>()
  let farthest: { flight: Flight; km: number } | null = null
  for (const f of completed) {
    const to = landingAirport(f)
    for (const code of new Set([f.from, to])) {
      visits.set(code, (visits.get(code) || 0) + 1)
      if (!firstVisits.has(code)) firstVisits.set(code, f.date)
    }
    const key = routeKey(f)
    const route = routes.get(key) || { key, from: f.from, to, count: 0 }
    route.count++; routes.set(key, route)
    const km = endpointDistance(index.get(f.from), index.get(to))
    if (km !== null) { totalKm += km; distanceCount++ }
    if (km !== null && km > 0 && (!farthest || km > farthest.km)) farthest = { flight: f, km }
  }
  const familiar = [...routes.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))[0] || null
  const frequency = new Map<string, { flight: Flight; count: number }>()
  for (const f of completed.filter(f => familiar && routeKey(f) === familiar.key && f.flightNumber)) {
    const key = flightIdentity(f).label
    const record = frequency.get(key) || { flight: f, count: 0 }
    record.count++; frequency.set(key, record)
  }
  const mostFlown = [...frequency.values()].sort((a,b) => b.count-a.count || flightIdentity(a.flight).label.localeCompare(flightIdentity(b.flight).label))[0] || null
  const rank = (values: string[]) => {
    const counts = new Map<string, number>()
    for (const name of values.filter(Boolean)) counts.set(name, (counts.get(name) || 0) + 1)
    return [...counts].map(([name,count]) => ({name,count})).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name))
  }
  const carriers = rank(completed.map(f => flightIdentity(f).airline?.name || f.airline?.trim().toUpperCase() || ''))
  const topRegistration = rank(completed.map(f => formatRegistration(f.registration)))[0] || null
  return {
    topAirlineFlight: completed.find(f => (flightIdentity(f).airline?.name || f.airline?.trim().toUpperCase()) === carriers[0]?.name),
    topRegistrationFlight: completed.find(f => f.aircraft && formatRegistration(f.registration) === topRegistration?.name),
    airlineCount: carriers.length, topAirline: carriers[0] || null,
    topAircraft: rank(completed.map(f => f.aircraft?.trim() || ''))[0] || null,
    topRegistration,
    mostFlown,
    count: completed.length, first: completed[0] || null, farthest, totalKm, distanceCount,
    familiar,
    airports: [...visits].map(([code, count]) => ({ code, count, firstDate: firstVisits.get(code)! })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
  }
}
