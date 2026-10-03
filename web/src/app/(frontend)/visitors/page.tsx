import TitleReveal from '@/components/TitleReveal'
import { getPayload } from 'payload'
import config from '@payload-config'
import { airports } from '@/lib/flights/airports'
import CheckinDesk from '@/components/CheckinDesk'
export const dynamic = 'force-dynamic'
export const metadata = { title:'候机室', description:'下一程之前，留个名字，聊两句。' }
export default async function VisitorsPage() {
  const payload=await getPayload({config})
  const {docs}=await payload.find({collection:'checkins',overrideAccess:false,depth:0,limit:30,sort:'-createdAt'})
  return <div className="waiting-room lounge-room"><header className="lounge-heading"><p className="kicker">MERAK / THE WAITING ROOM</p><div><h1><TitleReveal text="目的地，" /><br /><TitleReveal text="杭州。" /></h1><p>欢迎来到米拉克的候机室。<br />选好出发地，我们杭州见。</p></div></header><CheckinDesk airports={airports.map(({iata,city,name})=>({iata,city,name}))} entries={docs.map(e=>({id:e.id,name:e.name,message:e.message,date:e.createdAt.slice(0,10)}))} /></div>
}
