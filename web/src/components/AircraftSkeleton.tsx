'use client'

import { useId } from 'react'

// A local silhouette remains available even while the CDN image is unavailable.
const silhouette = 'M82 490Q100 467 169 443L224 412Q246 404 286 404H1255L1428 214H1506L1440 421L1514 438V456L1458 468L1340 486Q1210 528 990 541H291Q143 541 88 510Z M505 514L930 443L967 425L947 459L748 535L663 548Z M527 523Q527 514 542 514H660Q675 514 680 533V566Q675 580 657 580H541Q527 580 527 566Z'

export default function AircraftSkeleton() {
  const id = useId().replaceAll(':', '')
  return <svg className="aircraft-skeleton" viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-outline`}><path d={silhouette} /></clipPath>
      <linearGradient id={`${id}-shine`}><stop stopColor="var(--paper)" stopOpacity="0" /><stop offset=".5" stopColor="var(--paper)" stopOpacity=".75" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={silhouette} className="aircraft-skeleton-body" />
    <g clipPath={`url(#${id}-outline)`}><rect className="aircraft-skeleton-sweep" x="-1600" y="0" width="1600" height="800" fill={`url(#${id}-shine)`} /></g>
    <path d="M245 457H1195M551 523V570M664 530V566" fill="none" stroke="var(--paper)" strokeWidth="5" opacity=".4" />
  </svg>
}
