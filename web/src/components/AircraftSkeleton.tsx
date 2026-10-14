'use client'

import { useId } from 'react'

// A350-inspired side profile, available locally before any CDN image loads.
const silhouette = 'M83 491Q95 473 133 454Q158 426 205 413Q241 403 279 403H1216Q1270 403 1353 423L1515 432V447L1423 470Q1298 507 1157 527Q1099 539 971 539H243Q125 536 91 518Q82 510 83 491Z M1246 404L1439 224Q1448 219 1464 219H1514L1442 429Z M1319 444L1484 423L1515 428L1468 449L1370 476Z M670 483L977 440Q1003 437 1024 413L1064 387L1072 390L1040 427Q1027 439 1005 445L787 506L718 529Z M505 514Q513 496 553 490Q604 479 676 495L684 502V558Q685 575 654 575H576Q556 573 552 558V540L526 535Z'

export default function AircraftSkeleton() {
  const id = useId().replaceAll(':', '')
  return <svg className="aircraft-skeleton" viewBox="0 0 1600 800" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-outline`}><path d={silhouette} /></clipPath>
      <linearGradient id={`${id}-shine`}><stop stopColor="var(--paper)" stopOpacity="0" /><stop offset=".5" stopColor="var(--paper)" stopOpacity=".75" /><stop offset="1" stopColor="var(--paper)" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={silhouette} className="aircraft-skeleton-body" />
    <g clipPath={`url(#${id}-outline)`}><rect className="aircraft-skeleton-sweep" x="-1600" y="0" width="1600" height="800" fill={`url(#${id}-shine)`} /></g>
    <path d="M245 455H1190M558 500V560M679 506V559M127 455L145 449H160" fill="none" stroke="var(--paper)" strokeWidth="5" opacity=".4" />
  </svg>
}
