'use client'

import { useId } from 'react'
import type { AircraftLightLayout } from '@/lib/flights/aircraft-lights'

// Collins A320 LED reference: wing 50 ms ON / 60 ms OFF / 50 ms ON,
// 60 groups/minute. Upper beacon uses a 200 ms pulse half a cycle later.
// Rearward strobe: 110 ms single pulse, aligned with the first wing flash.
// Source: 06_0010 LED Anti-Collision Lighting System A320, pp. 3, 5, 6, 8.
// Representative equipment profile, not a registration-specific installation.
// A320-family timings are documented; Airbus widebody samples reuse this profile
// for visual review only. Boeing timings are provisional; C919 is fitted to user footage.
function WhiteFlare({ x, y, gradient, subdued = false, bright = false }: { x: number; y: number; gradient: string; subdued?: boolean; bright?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${bright ? 1.15 : subdued ? .6 : 1})`} opacity={subdued && !bright ? .7 : 1}>
    {bright && <circle r="55" fill={`url(#${gradient})`} opacity=".5" />}
    <circle r="38" fill={`url(#${gradient})`} opacity=".65" />
    <circle r="12" fill={`url(#${gradient})`} />
    <ellipse rx="38" ry="2" transform="rotate(-45)" fill={`url(#${gradient})`} opacity=".6" />
    <ellipse rx="24" ry=".6" transform="rotate(-45)" fill="#fff" opacity=".45" />
    <circle r="3.2" fill="#fff" />
  </g>
}

function RedFlare({ x, y, gradient }: { x: number; y: number; gradient: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse rx="28" ry="20" fill={`url(#${gradient})`} opacity=".7" />
    <ellipse rx="32" ry="2.2" transform="rotate(-45)" fill={`url(#${gradient})`} opacity=".85" />
    <ellipse rx="17" ry=".65" transform="rotate(-45)" fill="#ff6553" opacity=".55" />
    <ellipse rx="3.4" ry="2.4" fill="#ff5748" />
    <circle r="1.3" fill="#ffd0bd" />
  </g>
}

export default function AircraftLights({ layout }: { layout: AircraftLightLayout }) {
  const id = useId().replaceAll(':', '')
  const [wingX, wingY] = layout.wing
  const [beaconX, beaconY] = layout.upperBeacon
  const [tailX, tailY] = layout.tail
  return <svg className="aircraft-lights" data-profile={layout.profile} viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-white`}><stop stopColor="#fff" /><stop offset=".09" stopColor="#f6fbff" stopOpacity=".96" /><stop offset=".24" stopColor="#dcefff" stopOpacity=".62" /><stop offset=".55" stopColor="#bedcff" stopOpacity=".18" /><stop offset="1" stopColor="#bedcff" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-red`}><stop stopColor="#ff604a" stopOpacity=".85" /><stop offset=".18" stopColor="#ff3824" stopOpacity=".42" /><stop offset=".55" stopColor="#ff301c" stopOpacity=".08" /><stop offset="1" stopColor="#ff301c" stopOpacity="0" /></radialGradient>
      <clipPath id={`${id}-wing`}><polygon points={layout.wingSurface} /></clipPath>
      <clipPath id={`${id}-body`}><polygon points={layout.upperSurface} /></clipPath>
    </defs>
    <g className="aircraft-wing-pulse">
      <ellipse cx={wingX - 16} cy={wingY + 5} rx="60" ry="18" fill={`url(#${id}-white)`} opacity=".3" clipPath={`url(#${id}-wing)`} />
      <WhiteFlare x={wingX} y={wingY} gradient={`${id}-white`} />
    </g>
    <g className="aircraft-tail-pulse"><WhiteFlare x={tailX} y={tailY} gradient={`${id}-white`} subdued bright={layout.tailBright} /></g>
    <g className="aircraft-beacon-pulse">
      <ellipse cx={beaconX} cy={beaconY + 7} rx="64" ry="18" fill={`url(#${id}-red)`} opacity=".35" clipPath={`url(#${id}-body)`} />
      <RedFlare x={beaconX} y={beaconY} gradient={`${id}-red`} />
      {layout.lowerBeacon && <RedFlare x={layout.lowerBeacon[0]} y={layout.lowerBeacon[1]} gradient={`${id}-red`} />}
    </g>
  </svg>
}
