import { translatedMetadata } from '@/lib/i18n/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import PitLane from '@/components/PitLane/PitLane'
import { getMetar, getPitLane } from '@/lib/pit-lane-server'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: "@i18n:nav.pitLane@", description: "@i18n:pitLane.lede@" }) }

export default async function PitLanePage() {
  const payload = await getPayload({ config })
  const [boxes, metar] = await Promise.all([getPitLane(payload), getMetar()])
  // Optional public inbox for applicants who prefer email; the channel is hidden when unset.
  const email = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(process.env.PIT_LANE_EMAIL || '') ? process.env.PIT_LANE_EMAIL : undefined
  return <PitLane boxes={boxes} metar={metar} now={Date.now()} email={email}/>
}
