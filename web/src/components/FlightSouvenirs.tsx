import { airlineLogoURL } from '@/lib/assets'
import AircraftLabel from './AircraftLabel'
import FlightNumber from './FlightNumber'
import AircraftPortrait from './AircraftPortrait'
import { flightIdentity } from '@/lib/flights/airlines'
import { flightAlliance } from '@/lib/flights/alliances'
import { flightSouvenirs, landingAirport } from '@/lib/flights/souvenirs'
import type { DisplayFlight } from './FlightBoard'
const dateLabel = (date: string) => date.replaceAll('-', '.')
export default function FlightSouvenirs({souvenirs,airportName,open,filterRoute}: {
 souvenirs: ReturnType<typeof flightSouvenirs>; airportName:(code:string)=>string;
 open:(flight:DisplayFlight)=>void; filterRoute:(route:string)=>void;
}) {
 const carrier = souvenirs.topAirlineFlight && flightIdentity(souvenirs.topAirlineFlight).airline
 const alliance = souvenirs.topAirlineFlight && flightAlliance(souvenirs.topAirlineFlight)
 return <>
    {souvenirs.count > 0 && <section className="souvenir-cover" aria-labelledby="souvenir-heading">
      <div className="souvenir-heading"><div><p className="kicker">FLIGHT NOTES</p><h2 id="souvenir-heading">飞行片段</h2></div><p><span>一些常客，一些初见</span></p></div>
      <div className="souvenir-pieces">
        {souvenirs.familiar && <button className="souvenir-piece familiar-ticket" onClick={() => filterRoute(souvenirs.familiar!.key)}>
          <span className="piece-eyebrow">ON REPEAT <span>最常飞的航线</span></span>
          <span className="piece-route">{souvenirs.familiar.from}<i>↔</i>{souvenirs.familiar.to}</span>
          <span className="piece-cities">{airportName(souvenirs.familiar.from)} · {airportName(souvenirs.familiar.to)}</span>
          {souvenirs.mostFlown && <span className="piece-flight"><FlightNumber flight={souvenirs.mostFlown.flight} /><small>这条航线上坐过 {souvenirs.mostFlown.count} 次</small></span>}
          <span className="repeat-count"><strong>{souvenirs.familiar.count}</strong><span>次单程飞行<br />含两个方向</span><small>查看记录</small></span>
        </button>}
        {souvenirs.first && <button className="souvenir-piece first-ticket" onClick={() => open(souvenirs.first!)}>
          <span className="piece-eyebrow">FIRST ON RECORD</span><span className="first-ticket-title">最早的<br />一条记录</span>
          <span className="piece-route">{souvenirs.first.from}<i>→</i>{landingAirport(souvenirs.first)}</span>
          <span className="piece-flight"><FlightNumber flight={souvenirs.first} /></span><span className="piece-foot"><time>{dateLabel(souvenirs.first.date)}</time><span>查看航程</span></span>
        </button>}
        {souvenirs.farthest && <button className="souvenir-piece far-ticket" onClick={() => open(souvenirs.farthest!.flight)}>
          <span className="piece-eyebrow">LONGEST ROUTE <span>最远的一程</span></span>
          <span className="distance-number">{Math.round(souvenirs.farthest.km).toLocaleString('en-US')}<small>KM</small></span>
          <span className="distance-thread" aria-hidden="true"><svg viewBox="0 0 300 30" preserveAspectRatio="none"><path d="M0 15H138M162 15H300" /></svg><span>✈</span></span>
          <span className="piece-route">{souvenirs.farthest.flight.from}<i>→</i>{landingAirport(souvenirs.farthest.flight)}</span>
          <span className="piece-flight"><FlightNumber flight={souvenirs.farthest.flight} /></span><span className="piece-foot">起终点大圆距离估算<span>查看航程</span></span>
        </button>}
      </div>
      <div className="flight-facts">{[
        { code: 'PREFERRED CARRIER', kind: 'carrier', model: souvenirs.topAirline?.name === '中国东方航空' ? { aircraft: 'Boeing 777-300', airline: 'CES' } : souvenirs.topAirlineFlight, label: '最常搭乘的航司', value: souvenirs.topAirline?.name, count: souvenirs.topAirline?.count, unit: '段飞行', note: `共搭乘 ${souvenirs.airlineCount} 家航司` },
        { code: 'FLEET FAVOURITE', kind: 'aircraft', model: { aircraft: souvenirs.topAircraft?.name === 'Airbus A321' ? 'Airbus A321neo LR' : souvenirs.topAircraft?.name }, label: '最常乘坐的机型', value: souvenirs.topAircraft?.name, count: souvenirs.topAircraft?.count, unit: '次乘坐', note: '按已记录的机型统计' },
        { code: 'FAMILIAR TAIL', kind: 'tail', model: souvenirs.topRegistrationFlight, label: '又遇见这架飞机', value: souvenirs.topRegistration?.name, count: souvenirs.topRegistration?.count, unit: '次相遇', note: '按已记录的注册号统计' },
      ].filter(item => item.value).map(item => <article className={`fact-card fact-${item.kind}`} key={item.label}><header><span>{item.code}</span><i aria-hidden="true" className="fact-plane" /></header><span className="fact-label">{item.label}</span><h3 className={item.kind === 'carrier' ? 'fact-carrier-identity' : undefined}>{item.kind === 'carrier' && carrier ? <>
        <img className={carrier.icao === 'CES' ? 'carrier-wordmark' : 'carrier-mark'} src={airlineLogoURL(carrier.icao, true)} alt={item.value} />
        {alliance && <img className={`carrier-alliance alliance-${alliance.key}`} src={alliance.src} alt={alliance.name} />}
      </> : item.kind === 'aircraft' ? <AircraftLabel aircraft={item.value} /> : item.value}</h3>{item.kind === 'tail' && item.model?.aircraft && <span className="fact-tail-aircraft"><AircraftLabel aircraft={item.model.aircraft} /></span>}{item.model && <AircraftPortrait flight={item.model} />}<div className="fact-tally"><strong>{item.count}</strong><span>{item.unit}</span></div><footer><span>{item.note}</span><i className="fact-barcode" aria-hidden="true" /></footer></article>)}</div>
      <p className="souvenir-method">根据已完成的飞行记录整理；最远航程按机场间距离估算。 </p>
    </section>}

</> }
