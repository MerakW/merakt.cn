type Direction = 'right' | 'left' | 'down' | 'up-right'

/** UI arrows must not depend on the platform's text/emoji font selection. */
export default function ArrowIcon({ direction = 'right' }: { direction?: Direction }) {
  const angle = { right: 0, left: 180, down: 90, 'up-right': -45 }[direction]
  return <svg className="ui-arrow" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><g transform={`rotate(${angle} 12 12)`}><line x1="4" y1="12" x2="20" y2="12" /><polyline points="13,5 20,12 13,19" /></g></svg>
}
