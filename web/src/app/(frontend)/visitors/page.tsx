import { translatedMetadata } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
import TitleReveal from '@/components/TitleReveal'
import { getPayload } from 'payload'
import config from '@payload-config'
import { airports } from '@/lib/flights/airports'
import CheckinDesk from '@/components/CheckinDesk'
export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title:"@i18n:nav.lounge@", description:"@i18n:ui.beforeTheNextJourneyLeaveYourNameAnd@" }) }
export default async function VisitorsPage() {
  const payload=await getPayload({config})
  const {docs}=await payload.find({collection:'checkins',overrideAccess:false,depth:0,limit:30,sort:'-createdAt'})
  return <Localized><div className="waiting-room lounge-room"><header className="lounge-heading"><p className="kicker">MERAK / THE WAITING ROOM</p><div><h1><TitleReveal text="@i18n:ui.destination@" /><br /><TitleReveal text="@i18n:ui.hangzhou@" /></h1></div></header><CheckinDesk airports={airports.map(({iata,city,name})=>({iata,city,name}))} entries={docs.map(e=>({id:e.id,name:e.name,message:e.message,date:e.createdAt.slice(0,10)}))} /></div></Localized>
}
