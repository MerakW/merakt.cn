import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { notFound } from 'next/navigation'
import FlightBoard from '@/components/FlightBoard'
import { airportMap } from '@/lib/flights/airports'
import { publicFlight, selectFeaturedFlight } from '@/lib/flights/public'
import type { ImportPreview } from '@/lib/flights/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '飞行页设计预览', robots: { index: false, follow: false } }

export default async function DesignFlightsPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  let data: ImportPreview
  try { data = JSON.parse(await readFile(resolve('.data/flighty-preview.json'), 'utf8')) } catch { notFound() }
  // Local design preview only. Never change the stored visibility of source records.
  const flights = data.flights.map((f, index) => ({ ...f, id: index, visibility: 'public' as const }))
  const used = new Set(flights.flatMap(f => [f.from, f.to, f.divertedTo].filter(Boolean) as string[]))
  return <FlightBoard preview flights={flights.map(publicFlight)} featured={selectFeaturedFlight(flights)} airports={[...used].flatMap(code => airportMap.has(code) ? [airportMap.get(code)!] : [])} />
}
