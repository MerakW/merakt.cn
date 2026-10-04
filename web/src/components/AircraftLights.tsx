'use client'

import { useId } from 'react'
import type { AircraftLightLayout } from '@/lib/flights/aircraft-lights'

// Collins A320 LED reference: wing 50 ms ON / 60 ms OFF / 50 ms ON,
// 60 groups/minute. Upper beacon uses a 200 ms pulse half a cycle later.
// Source: 06_0010 LED Anti-Collision Lighting System A320, pp. 3, 5, 6, 8.
// Representative equipment profile, not a registration-specific installation.
export default function AircraftLights({ layout }: { layout: AircraftLightLayout }) {
  const id = useId().replaceAll(':', '')
  const [wingX, wingY] = layout.wing
  const [beaconX, beaconY] = layout.upperBeacon
  return <svg className="aircraft-lights" viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-white`}><stop stopColor="#fff" stopOpacity=".8" /><stop offset=".16" stopColor="#e7f2ff" stopOpacity=".38" /><stop offset=".5" stopColor="#dcecff" stopOpacity=".09" /><stop offset="1" stopColor="#dcecff" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-red`}><stop stopColor="#ff604a" stopOpacity=".85" /><stop offset=".18" stopColor="#ff3824" stopOpacity=".42" /><stop offset=".55" stopColor="#ff301c" stopOpacity=".08" /><stop offset="1" stopColor="#ff301c" stopOpacity="0" /></radialGradient>
      <clipPath id={`${id}-wing`}><polygon points={layout.wingSurface} /></clipPath>
      <clipPath id={`${id}-body`}><polygon points={layout.upperSurface} /></clipPath>
    </defs>
    <g className="aircraft-wing-pulse">
      <ellipse cx={wingX - 28} cy={wingY + 8} rx="100" ry="28" fill={`url(#${id}-white)`} opacity=".5" clipPath={`url(#${id}-wing)`} />
      <circle cx={wingX} cy={wingY} r="38" fill={`url(#${id}-white)`} />
      <ellipse cx={wingX} cy={wingY} rx="12" ry="1.4" fill="#fff" opacity=".7" />
      <circle cx={wingX} cy={wingY} r="3.8" fill="#fff" />
    </g>
    <g className="aircraft-beacon-pulse">
      <ellipse cx={beaconX} cy={beaconY + 10} rx="106" ry="28" fill={`url(#${id}-red)`} opacity=".55" clipPath={`url(#${id}-body)`} />
      <ellipse cx={beaconX} cy={beaconY} rx="31" ry="20" fill={`url(#${id}-red)`} />
      <ellipse cx={beaconX} cy={beaconY} rx="4.2" ry="2.5" fill="#ff7561" />
    </g>
  </svg>
}
