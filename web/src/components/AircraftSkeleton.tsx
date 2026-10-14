'use client'

import { useId } from 'react'

// A350-inspired side profile, available locally before any CDN image loads.
const silhouette = 'M83 498C83 481 106 467 128 454C149 431 175 420 203 414C229 408 254 404 284 404H1257L1436 227Q1447 220 1462 220H1511L1448 422L1513 427V443L1466 460L1362 481C1260 513 1159 536 1025 536H715C702 536 690 538 684 544L684 556C683 565 674 570 657 572C634 575 602 575 579 571C566 569 558 565 555 558C553 552 553 545 553 537H268C207 540 141 535 105 523C90 518 83 510 83 498Z'
const cockpitMask = 'M125 454C133 445 142 442 152 444C163 444 169 450 168 456C167 462 156 463 145 460L132 458Z'
// Nested even-odd contours cut out the black surround but fill the glass panes.
const cockpitGlass = 'M131 452L139 448L142 456L133 455Z M145 448L155 448L163 452L160 456L147 455Z'
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
