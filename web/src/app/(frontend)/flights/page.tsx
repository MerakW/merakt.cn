import { getFlightPageData } from '@/lib/flights/page-data'
import FlightBoard from '@/components/FlightBoard'
import { airportMap } from '@/lib/flights/airports'
import { publicFlight, selectFeaturedFlight } from '@/lib/flights/public'

export const dynamic = 'force-dynamic'
export const metadata = { title: '飞行记录' }

export default async function FlightsPage() {
  const { flights, preview } = await getFlightPageData()
  const usedCodes = new Set(flights.flatMap(f => [f.from, f.to, f.divertedTo].filter(Boolean) as string[]))
  const airports = [...usedCodes].flatMap(code => airportMap.has(code) ? [airportMap.get(code)!] : [])
  return <FlightBoard preview={preview} flights={flights.map(publicFlight)} featured={selectFeaturedFlight(flights)} airports={airports} />
}
