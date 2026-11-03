import 'server-only'
import type { Payload } from 'payload'
import { publicPhoto } from './gallery'
import { LOGO_BADGE_PREFIX, buildPitLane, type FriendInput, type PitBox } from './pit-lane'
import type { Friend } from '@/payload-types'

/** Public pit lane, safe for anonymous rendering; missing schema (pre-migration) yields an empty lane. */
export async function getPitLane(payload: Payload): Promise<PitBox[]> {
  try {
    const { docs } = await payload.find({ collection: 'friends', where: { status: { equals: 'approved' } }, depth: 1, limit: 200, pagination: false, overrideAccess: false, sort: 'bay' })
    return buildPitLane((docs as Friend[]).map((friend): FriendInput => {
      const media = friend.logoSource === 'upload' ? friend.avatar : friend.logoSource === 'auto' ? friend.logo : null
      const image = publicPhoto(media ?? null)
      const badge = friend.logoSource === 'auto' && typeof media === 'object' && Boolean(media?.filename?.startsWith(LOGO_BADGE_PREFIX))
      return { ...friend, image: image?.thumbnail || null, imageKind: badge ? 'badge' : 'plate', health: friend.health ?? null }
    }))
  } catch { return [] }
}

const FALLBACK_METAR = 'METAR ZSHC ——Z VRB02MPS CAVOK ——/—— Q———— NOSIG'
/** Live ZSHC METAR from aviationweather.gov, cached for 30 minutes; decorative, so failure is silent. */
export async function getMetar(): Promise<string> {
  if (process.env.PIT_LANE_METAR === '0') return FALLBACK_METAR
  try {
    const response = await fetch('https://aviationweather.gov/api/data/metar?ids=ZSHC&format=raw', { next: { revalidate: 1800 }, signal: AbortSignal.timeout(2500), headers: { 'User-Agent': 'MerakPitLane/1.0 (+https://merakt.cn)' } })
    const text = response.ok ? (await response.text()).trim().split('\n')[0] : ''
    return /^(METAR |SPECI )?ZSHC \d{6}Z [ -~]{8,160}$/.test(text) ? (text.startsWith('ZSHC') ? `METAR ${text}` : text) : FALLBACK_METAR
  } catch { return FALLBACK_METAR }
}
