'use client'

import { useId } from 'react'

// A350-inspired side profile, available locally before any CDN image loads.
const silhouette = 'M83 498C83 481 106 467 128 454C149 431 175 420 203 414C229 408 254 404 284 404H1257L1436 227Q1447 220 1462 220H1511L1448 422L1513 427V443L1466 460L1362 481C1260 513 1159 536 1025 536H714C699 536 688 540 688 552V558C688 570 678 575 658 576C632 578 600 577 578 574C561 572 552 565 552 551V540H268C207 540 141 535 105 523C90 518 83 510 83 498Z'
const windscreen = 'M128 453C134 447 140 445 148 445C158 444 164 448 165 453C166 458 161 461 154 460L138 458Z'
const outline = `${silhouette} ${windscreen}`

export default function AircraftSkeleton() {
  const id = useId().replaceAll(':', '')
  return <svg className="aircraft-skeleton" viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-outline`}><path d={outline} fillRule="evenodd" clipRule="evenodd" /></clipPath>
      <linearGradient id={`${id}-shine`}><stop stopColor="var(--paper)" stopOpacity="0" /><stop offset=".5" stopColor="var(--paper)" stopOpacity=".75" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={outline} fillRule="evenodd" className="aircraft-skeleton-body" />
    <g clipPath={`url(#${id}-outline)`}><rect className="aircraft-skeleton-sweep" x="-1600" y="0" width="1600" height="800" fill={`url(#${id}-shine)`} /></g>
  </svg>
}
