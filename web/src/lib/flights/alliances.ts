import { flightIdentity } from './airlines'

type Alliance = 'skyteam' | 'star' | 'oneworld'
const names = { skyteam: 'SkyTeam · 天合联盟', star: 'Star Alliance · 星空联盟', oneworld: 'oneworld · 寰宇一家' }
const memberships: Record<string, { alliance: Alliance; from: string; until?: string; partner?: boolean }> = {
  CES: {alliance:'skyteam',from:'2011-06-21'}, CSH: {alliance:'skyteam',from:'2011-06-21'},
  CXA: {alliance:'skyteam',from:'2012-11-21'}, HVN: {alliance:'skyteam',from:'2010-06-10'},
  CSN: {alliance:'skyteam',from:'2007-11-15',until:'2020-01-01'},
  CCA: {alliance:'star',from:'2007-12-12'}, ANA: {alliance:'star',from:'1999-10-15'}, SIA: {alliance:'star',from:'2000-04-01'},
  DKH: {alliance:'star',from:'2017-05-23',partner:true},
  CPA: {alliance:'oneworld',from:'1999-02-01'}, QTR: {alliance:'oneworld',from:'2013-10-30'},
  HDA: {alliance:'oneworld',from:'2007-11-01',until:'2020-10-21'},
}
export function flightAlliance(flight: {airline?: string | null; flightNumber?: string | null; date?: string | null}) {
  const icao = flightIdentity(flight).airline?.icao
  const membership = icao && memberships[icao]
  if (!membership) return undefined
  const date = flight.date || '9999-12-31'
  if (date < membership.from || (membership.until && date >= membership.until)) return undefined
  const transition = icao === 'CSN' && date >= '2019-01-01'
  return { key: membership.alliance, name: names[membership.alliance] + (membership.partner ? ' · 优连伙伴' : transition ? ' · 退出过渡期' : ''), src: `/alliances/${membership.alliance === 'star' ? 'star-updated' : membership.alliance}.${membership.alliance === 'skyteam' ? 'png' : 'svg'}` }
}
