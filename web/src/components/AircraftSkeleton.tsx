'use client'

import { useId } from 'react'

// A350-inspired side profile, available locally before any CDN image loads.
const silhouette = 'M83 491Q94 472 128 455Q150 428 195 414Q226 405 274 404L1257 404L1436 227Q1447 220 1462 220H1511L1448 422L1513 427V443L1466 460L1362 481Q1260 513 1122 531Q1082 536 1025 536H687V556Q687 574 660 574H578Q555 572 554 555V539H261Q144 536 99 521Q82 515 83 491Z'

export default function AircraftSkeleton() {
  const id = useId().replaceAll(':', '')
  return <svg className="aircraft-skeleton" viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-outline`}><path d={silhouette} /></clipPath>
      <linearGradient id={`${id}-shine`}><stop stopColor="var(--paper)" stopOpacity="0" /><stop offset=".5" stopColor="var(--paper)" stopOpacity=".75" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={silhouette} className="aircraft-skeleton-body" />
    <g clipPath={`url(#${id}-outline)`}><rect className="aircraft-skeleton-sweep" x="-1600" y="0" width="1600" height="800" fill={`url(#${id}-shine)`} /></g>
    <path d="M127 454Q139 444 150 446L161 450Q167 454 160 459L142 458" fill="none" stroke="var(--muted)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".65" />
  </svg>
}
