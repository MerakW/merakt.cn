'use client'

import { useId } from 'react'

// A350-inspired side profile, available locally before any CDN image loads.
const silhouette = 'M83 498C83 481 106 467 128 454C149 431 175 420 203 414C229 408 254 404 284 404H1257L1436 227Q1447 220 1462 220H1511L1448 422L1513 427V443L1466 460L1362 481C1260 513 1159 536 1025 536H727L710 542L685 547V556C685 561 683 565 675 567C649 575 592 576 567 568C558 565 555 562 554 556L552 537H268C207 540 141 535 105 523C90 518 83 510 83 498Z'
const cockpitMask = 'M120 455L127 449L131 445L135 448C142 444 151 444 158 447C165 449 167 453 164 458C161 463 151 464 142 460C134 457 126 457 120 458Z'
// Nested even-odd contours cut out the black surround but fill the glass panes.
const cockpitGlass = 'M129 450L132 448L135 451L138 455L131 453Z M139 450C145 447 151 447 157 449C161 451 162 454 160 457C157 460 150 460 144 457L140 455Z'
const outline = `${silhouette} ${cockpitMask} ${cockpitGlass}`

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
