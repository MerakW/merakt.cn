/**
 * HGH APRON & PIT LANE — shared, client-safe logic for the friend-links page.
 * Virtual telemetry (lap, frequency, bearing) is derived deterministically from each
 * team's three-letter code so a friend always sees the same "archive" values.
 */
export type Tyre = 'S' | 'M' | 'H' | 'I' | 'W'
export type PitState = 'green' | 'inter' | 'wet' | 'red'
export type TyreMode = 'auto' | 'manual'
/** The current Pirelli line-up: three dry slicks plus intermediates and full wets. */
export const TYRES: Tyre[] = ['S', 'M', 'H', 'I', 'W']
export type FriendTyre = Tyre
export const FRIEND_TYRES: Tyre[] = TYRES
/** Pirelli sidewall colours; also used to match a team's livery to its compound. */
export const TYRE_COLORS: Record<Tyre, string> = { S: '#e8303b', M: '#edc534', H: '#f4f4f0', I: '#35b77c', W: '#2f7fe0' }

/** MRK does not race: Merak drives the safety car, which comes out at random during a race. */
export const SAFETY_CAR = { tla: 'MRK', number: 51, frequency: '118.200', color: '#9b5cff' }
/** Window event asking the mounted pit lane to box out a garage (detail: TLA). */
export const PIT_BOX_EVENT = 'merak:pit-box'
export type TowerBox = { tla: string; name: string; state: PitState; frequency: string; tyre: Tyre }
export const RESERVED_TLAS = new Set(['MRK', 'HGH', 'SOS', 'FIA'])
export const TLA_PATTERN = /^[A-Z]{3}$/
export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export type Health = { state?: PitState | null; failStreak?: number | null; okStreak?: number | null; history?: string | null; latencyMs?: number | null; checkedAt?: string | null }
export type ProbeResult = { ok: boolean; status?: number; latencyMs?: number; retryAfter?: boolean }

/** Auto logos are baked into padded badges by the monitor; their files carry this prefix. */
export const LOGO_BADGE_PREFIX = 'pit-logo-v2-'
export type LogoKind = 'badge' | 'plate'
/** Lettering colour for a livery on dark garage walls: very dark liveries are lifted toward white. */
export function teamInk(hex: string): string {
  if (!HEX_PATTERN.test(hex)) return hex
  const { l } = oklch(hex)
  return l >= 0.55 ? hex : `color-mix(in oklab, ${hex} ${Math.round(35 + l * 60)}%, #fff)`
}
export type FriendInput = {
  id: number | string
  tla: string
  name: string
  url: string
  teamColor?: string | null
  bio?: string | null
  coolingMsg?: string | null
  image?: string | null
  /** 'badge' = composed by the monitor (opaque, padded); 'plate' = manual upload shown on a white plate. */
  imageKind?: LogoKind | null
  tyreMode?: TyreMode | null
  tyre?: Tyre | null
  maintenance?: boolean | null
  bearing?: number | null
  distance?: number | null
  bay?: number | null
  joinedAt?: string | null
  health?: Health | null
}

export type PitBox = {
  id: string
  tla: string
  name: string
  url: string
  color: string
  bio: string
  coolingMsg: string
  image?: string
  imageKind?: LogoKind
  tyre: Tyre
  state: PitState
  bay: number
  bayLabel: string
  bearing: number
  distance: number
  lapMs: number | null
  lap: string
  frequency: string
  position: number | null
  gap: string
  scope: { x: number; y: number }
}

/** 32-bit FNV-1a; stable across runtimes. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (const char of text) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 0x01000193) >>> 0 }
  return hash >>> 0
}
/** Small seeded PRNG (mulberry32) returning [0, 1). */
export function seeded(seed: number) {
  let state = seed >>> 0
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function formatLap(ms: number | null): string {
  if (ms === null) return '—:——.———'
  const minutes = Math.floor(ms / 60000), seconds = Math.floor(ms % 60000 / 1000), millis = Math.round(ms % 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}
export function formatGap(ms: number): string {
  return ms >= 60000 ? `+${formatLap(ms)}` : `+${(ms / 1000).toFixed(3)}`
}
export const pad3 = (value: number) => String(Math.round(value) % 360).padStart(3, '0')

/** Qualifying lap round West Lake (~10.4 km): 3:10.000–3:21.999, wet adds 17–24 s, red flag has no lap. */
export function virtualLap(tla: string, state: PitState): number | null {
  if (state === 'red') return null
  const random = seeded(fnv1a(`lap:${tla}`))
  const base = 190000 + Math.floor(random() * 12000)
  return state === 'wet' ? base + 17000 + Math.floor(random() * 7000) : state === 'inter' ? base + 3600 + Math.floor(random() * 3600) : base
}
/** Aviation VHF on 25 kHz spacing, 118.000–136.975, never the 121.500 guard frequency. */
export function virtualFrequency(tla: string): string {
  let step = fnv1a(`freq:${tla}`) % 760
  if (step === 140) step = 141
  return (118 + step * 0.025).toFixed(3)
}
export function virtualBearing(tla: string): { bearing: number; distance: number } {
  const random = seeded(fnv1a(`brg:${tla}`))
  const bearing = Math.floor(random() * 360)
  const distance = Math.round(5 * Math.pow(180, random()))
  return { bearing, distance }
}
/** Log-compressed polar position inside a 300×300 scope centred on HGH. */
export function scopePoint(bearing: number, distance: number, radius = 128): { x: number; y: number } {
  const r = Math.min(radius, 22 + 38 * Math.log10(1 + Math.max(0, distance)))
  const angle = bearing * Math.PI / 180
  return { x: +(150 + r * Math.sin(angle)).toFixed(1), y: +(150 - r * Math.cos(angle)).toFixed(1) }
}

/** sRGB hex → OKLCH chroma and hue (degrees). */
export function oklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = [1, 3, 5].map(index => { const v = parseInt(hex.slice(index, index + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 }
}
const CHROMATIC = (['S', 'M', 'I', 'W'] as Tyre[]).map(tyre => ({ tyre, h: oklch(TYRE_COLORS[tyre]).h }))
/** Nearest compound to a livery colour by OKLCH hue (purple runs the wet blue); greys, black and white run the white-wall hard. */
export function colorTyre(hex?: string | null): Tyre {
  if (!hex || !HEX_PATTERN.test(hex)) return 'W'
  const { c, h } = oklch(hex)
  if (c < 0.05) return 'H'
  const gap = (a: number) => Math.min(Math.abs(a - h), 360 - Math.abs(a - h))
  return CHROMATIC.reduce((best, item) => gap(item.h) < gap(best.h) ? item : best).tyre
}
/** Starting compound: a manual choice wins, otherwise the compound closest to the livery colour. */
export function resolveTyre(friend: Pick<FriendInput, 'tyreMode' | 'teamColor'> & { tyre?: string | null }): Tyre {
  // Legacy values (the retired purple 'U') fall back to the livery match.
  if (friend.tyreMode === 'manual' && friend.tyre && FRIEND_TYRES.includes(friend.tyre as Tyre)) return friend.tyre as Tyre
  return colorTyre(friend.teamColor)
}
export function resolveState(friend: Pick<FriendInput, 'maintenance' | 'health'>): PitState {
  if (friend.maintenance) return 'wet'
  const state = friend.health?.state
  return state === 'red' || state === 'inter' || state === 'wet' ? state : 'green'
}

/** Health state machine: 3 consecutive failures raise a red flag, 2 successes clear it. */
export function nextHealth(previous: Health | null | undefined, probe: ProbeResult): Required<Pick<Health, 'state' | 'failStreak' | 'okStreak' | 'history'>> & { latencyMs: number | null } {
  const history = `${previous?.history || ''}${probe.ok ? '1' : '0'}`.slice(-8)
  const wasRed = previous?.state === 'red'
  if (!probe.ok) {
    const failStreak = (previous?.failStreak || 0) + 1
    const state: PitState = probe.status === 503 && probe.retryAfter ? 'wet' : failStreak >= 3 || wasRed ? 'red' : 'inter'
    return { state, failStreak, okStreak: 0, history, latencyMs: null }
  }
  const okStreak = (previous?.okStreak || 0) + 1
  const latencyMs = probe.latencyMs ?? null
  let state: PitState = history.includes('0') || (latencyMs !== null && latencyMs > 3000) ? 'inter' : 'green'
  if (wasRed && okStreak < 2) state = 'red'
  return { state, failStreak: 0, okStreak, history, latencyMs }
}

export function safeHttpURL(value?: string | null): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined } catch { return undefined }
}

/** Build the public, ordered pit lane: grid order by bay, timing tower order by virtual lap. */
export function buildPitLane(friends: FriendInput[], now = Date.now()): PitBox[] {
  const boxes = friends
    .filter(friend => TLA_PATTERN.test(friend.tla) && safeHttpURL(friend.url))
    .sort((a, b) => (a.bay ?? 9999) - (b.bay ?? 9999) || String(a.joinedAt || '').localeCompare(String(b.joinedAt || '')) || a.tla.localeCompare(b.tla))
    .map((friend, index): PitBox => {
      const state = resolveState(friend)
      const virtual = virtualBearing(friend.tla)
      const bearing = Number.isFinite(friend.bearing) ? ((Math.round(friend.bearing!) % 360) + 360) % 360 : virtual.bearing
      const distance = Number.isFinite(friend.distance) && friend.distance! >= 0 ? Math.round(friend.distance!) : virtual.distance
      const lapMs = virtualLap(friend.tla, state)
      const bay = friend.bay ?? index + 1
      return {
        id: String(friend.id), tla: friend.tla, name: friend.name, url: safeHttpURL(friend.url)!,
        color: friend.teamColor && HEX_PATTERN.test(friend.teamColor) ? friend.teamColor : '#2349ed',
        bio: friend.bio?.trim() || '', coolingMsg: friend.coolingMsg?.trim() || '', image: friend.image || undefined, imageKind: friend.image ? friend.imageKind || 'plate' : undefined,
        tyre: resolveTyre(friend), state, bay, bayLabel: `PIT ${String(bay).padStart(2, '0')} // BAY ${'ABCDEFGHJK'[Math.floor((bay - 1) / 2) % 10]}`,
        bearing, distance, lapMs, lap: formatLap(lapMs), frequency: virtualFrequency(friend.tla),
        position: null, gap: 'OUT', scope: scopePoint(bearing, distance),
      }
    })
  const running = boxes.filter(box => box.lapMs !== null).sort((a, b) => a.lapMs! - b.lapMs! || a.tla.localeCompare(b.tla))
  let previous = running[0]?.lapMs ?? 0
  running.forEach((box, index) => { box.position = index + 1; box.gap = index ? formatGap(Math.max(0, box.lapMs! - previous)) : 'POLE'; previous = box.lapMs! })
  return boxes
}
export function timingOrder(boxes: PitBox[]): PitBox[] {
  return [...boxes].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.tla.localeCompare(b.tla))
}

/** Display width for monospace tables: CJK and full-width glyphs take two cells. */
export function cellWidth(text: string): number {
  let width = 0
  for (const char of text) width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u.test(char) ? 2 : 1
  return width
}
export function padCells(text: string, width: number): string {
  let out = '', used = 0
  for (const char of text) { const w = cellWidth(char); if (used + w > width) break; out += char; used += w }
  return out + ' '.repeat(width - used)
}
