import type { CSSProperties, ReactNode } from 'react'
import Localized from '@/components/Localized'
import { imageURL } from '@/lib/assets'
import { SAFETY_CAR, TYRE_COLORS, formatLap, pad3, teamInk, type PitBox } from '@/lib/pit-lane'
import type { RaceView, Standing } from '@/lib/pit-race'

export { TYRE_COLORS }

export function Tyre({ compound }: { compound: string }) {
  return <span className="pl-tyre" data-c={compound} aria-label={`TYRE ${compound}`}>{compound}</span>
}
/** Live race position painted on the garage wall. */
export function PosChip({ live }: { live?: Standing }) {
  if (!live) return null
  const text = live.retired ? 'DNF' : live.inPit ? 'PIT' : `P${live.position}`
  return <span className={`pl-pos-chip${live.retired ? ' is-out' : live.inPit ? ' is-pit' : live.position === 1 ? ' is-lead' : ''}`} key={text} aria-label={`RACE ${text}`}>{text}</span>
}
function lapText(fallback: string, live?: Standing, fastest?: boolean) {
  if (!live?.lastLap) return <span>LAP {fallback}</span>
  return <span className={fastest ? 'pl-purple' : undefined}>{fastest ? 'FASTEST' : 'LAST'} {formatLap(fastest && live.bestLap ? live.bestLap : live.lastLap)}</span>
}
export function Logo({ box }: { box: Pick<PitBox, 'image' | 'imageKind' | 'tla'> }) {
  return box.image
    ? <div className="pl-logo" data-kind={box.imageKind || 'plate'}><img src={box.image} alt="" width={72} height={72} loading="lazy" decoding="async" referrerPolicy="no-referrer"/></div>
    : <div className="pl-logo pl-mono-mark" aria-hidden="true">{box.tla}<small>AUTO</small></div>
}

type CardProps = { box: PitBox; index?: number; preview?: boolean; boxing?: boolean; live?: Standing; fastest?: boolean; onBox?: (event: React.MouseEvent<HTMLAnchorElement>, box: PitBox) => void; children?: ReactNode }
/** One garage: shutter, logo, TLA + tyre, a short message and the BOX OUT footer. */
export default function PitBoxCard({ box, preview, boxing, live, fastest, onBox }: CardProps) {
  const red = box.state === 'red'
  const shutter = red ? 'CLOSED // RED FLAG' : box.bayLabel
  const body = <>
    <div className="pl-top" aria-hidden="true"><span className="pl-lamp"/><span className="pl-state"/><span className="pl-r" data-idle={`BRG ${pad3(box.bearing)}° · ${box.distance}NM`}/></div>
    <div className="pl-bay">{box.state === 'wet' && <i className="pl-rain"/>}<i className="pl-ceiling"/><Logo box={box}/><span className="pl-bay-no">{String(box.bay).padStart(2, '0')}</span><PosChip live={live}/><div className="pl-shutter"><span>{shutter}</span></div></div>
    <div className="pl-body">
      <div className="pl-id"><b className="pl-tla">{box.tla}</b><Tyre compound={live?.tyre ?? box.tyre} key={live?.tyre ?? box.tyre}/></div>
      <div className="pl-name" data-i18n="off">{box.name}</div>
      <p className="pl-bio" data-i18n="off">{box.bio || '—'}</p>
      <div className="pl-foot"><div className="pl-def">{lapText(box.lap, live, fastest)}<span>{box.frequency} MHz</span></div><div className="pl-alt"><span>{box.coolingMsg ? <span data-i18n="off">{box.coolingMsg}</span> : red ? "@i18n:pitLane.card.noRadio@" : box.state === 'wet' ? "@i18n:pitLane.card.wet@" : "@i18n:pitLane.card.visit@"}</span><b>{red ? 'NO RADIO ×' : 'BOX OUT ↗'}</b></div></div>
    </div>
  </>
  const style = { '--team': box.color, '--team-ink': teamInk(box.color) } as CSSProperties
  if (preview) return <Localized><div className="pl-box is-preview" data-state={box.state} data-tla={box.tla} style={style}>{body}</div></Localized>
  return <Localized><a className={`pl-box${boxing ? ' is-boxing' : ''}`} href={box.url} rel="noopener" data-tla={box.tla} data-state={box.state} style={style}
    aria-label={`${box.tla} · ${box.name} — ${red ? 'RED FLAG' : 'BOX OUT'}`} aria-describedby="pit-lane-hint" onClick={event => onBox?.(event, box)}>{body}</a></Localized>
}

/** MRK no longer races: it is the FRIENDS GP safety car, deployed at random during a race. */
export function SafetyCarCard({ view }: { view: RaceView }) {
  const sc = view.sc, formation = view.phase === 'formation', out = view.safetyCar || (formation ? 'out' : null)
  const status = formation ? 'FORMATION LAP' : out === 'in' ? 'SC IN THIS LAP' : out ? 'SAFETY CAR DEPLOYED' : 'STANDBY'
  const plan = formation ? 'LEADING THE FORMATION LAP' : sc && view.phase !== 'lights' && view.lap >= sc.from ? `${out ? 'DEPLOYED' : 'RAN'} · L${sc.from}–L${sc.to - 1}` : 'STANDBY'
  return <Localized><a className="pl-box pl-sc" href="/merak" data-tla={SAFETY_CAR.tla} data-sc={out || undefined} aria-label={`MRK #${SAFETY_CAR.number} · Merak — SAFETY CAR`}>
    <div className="pl-top" aria-hidden="true"><span className="pl-lamp"/><span className="pl-state" data-sc={status}/><span className="pl-r" data-idle={`HGH TOWER // ${SAFETY_CAR.frequency}`}/></div>
    <div className="pl-sc-in">
      <div className="pl-bay"><i className="pl-ceiling"/><div className="pl-logo pl-merak-mark"><img src={imageURL('/images/card/merak-mark.svg')} alt="" width={64} height={58}/></div><span className="pl-bay-no">51</span>{out && <span className="pl-pos-chip is-sc">SC</span>}<div className="pl-shutter"><span>HGH · 00</span></div></div>
      <div className="pl-body">
        <span className="pl-sc-tag"><i/>SAFETY CAR</span>
        <div className="pl-id"><b className="pl-tla">MRK</b><span className="pl-num">#{SAFETY_CAR.number}</span></div>
        <div className="pl-name">{"@i18n:pitLane.leader.name@"}</div>
        <p className="pl-bio">{"@i18n:pitLane.leader.bio@"}</p>
        <div className="pl-foot"><div className="pl-def"><span>{out && sc && !formation ? sc.reason : plan}</span><span>{SAFETY_CAR.frequency} MHz</span></div><div className="pl-alt"><span>{"@i18n:pitLane.leader.about@"}</span><b>ABOUT ↗</b></div></div>
      </div>
    </div>
  </a></Localized>
}

export function VacantCard({ bay, onOpen }: { bay: number; onOpen: () => void }) {
  return <Localized><a className="pl-box pl-vacant" href="#stewards" data-tla="---" onClick={onOpen}>
    <div className="pl-top" aria-hidden="true"><span className="pl-lamp"/><span className="pl-state"/><span className="pl-r" data-idle={`PIT ${String(bay).padStart(2, '0')} // RESERVED`}/></div>
    <div className="pl-bay"><div className="pl-shutter"><span>RESERVED</span></div><div className="pl-plus"><div><b>+</b>{"@i18n:pitLane.vacant.title@"}</div></div></div>
    <div className="pl-body"><div className="pl-id"><b className="pl-tla pl-muted">???</b></div><div className="pl-name">{"@i18n:pitLane.vacant.name@"}</div><p className="pl-bio">{"@i18n:pitLane.vacant.bio@"}</p>
      <div className="pl-foot"><div className="pl-def"><span>AWAITING CLEARANCE</span><span>--- MHz</span></div><div className="pl-alt"><span>STEWARDS DESK OPEN</span><b>APPLY ↓</b></div></div></div>
  </a></Localized>
}
