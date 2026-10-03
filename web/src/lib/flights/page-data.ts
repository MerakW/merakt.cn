import { getPayload } from 'payload'
import config from '@payload-config'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { FlightRecord, ImportPreview } from './types'

// Both homepage and flight page use the same local-only preview fallback.
// Production always reads published records through the collection access rules.
export async function getFlightPageData(): Promise<{ flights: FlightRecord[]; preview: boolean }> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'flights', limit: 1000, depth: 0, overrideAccess: false, context: { internalFlightDates: true }, sort: '-date' })
  if (docs.length || process.env.NODE_ENV !== 'development') return { flights: docs as unknown as FlightRecord[], preview: false }
  try {
    const data: ImportPreview = JSON.parse(await readFile(resolve('.data/flighty-preview.json'), 'utf8'))
    return { flights: data.flights.map((f, id) => ({ ...f, id, visibility: 'public' as const })), preview: true }
  } catch { return { flights: [], preview: false } }
}
