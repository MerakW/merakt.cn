import { translatedMetadata } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
import Comms from '@/components/Comms'
import PlaneIcon from '@/components/PlaneIcon'
import { imageURL } from '@/lib/assets'
import TitleReveal from '@/components/TitleReveal'
import { profile } from '@/lib/profile'
export async function generateMetadata() { return translatedMetadata({ title: "@i18n:profile.title@" }) }
export default function ProfilePage() {
  return <Localized><div className="profile-page"><header className="profile-hero"><div><p className="kicker">{"@i18n:ui.merak@"}</p><h1><TitleReveal text="MEET" /><br /><em><TitleReveal text="MERAK." /></em></h1><p>{profile.lead}</p><div className="profile-tags">{profile.tags.map(tag => <span key={tag}>{tag}</span>)}</div><a className="quiet-link" href="/card">{"@i18n:ui.myDigitalCard@"}</a></div><figure><img src={imageURL('/identity/merak-avatar.webp')} width={600} height={600} alt="@i18n:ui.meraksBlueAndWhiteFoxCharacter2@" /><figcaption>{"@i18n:ui.merakAlwaysMovingForward@"}</figcaption></figure></header><section className="profile-origin"><h2>{profile.origin}</h2><div><p>{profile.originText}</p><dl>{profile.basics.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></section><section className="profile-interests"><h2>{profile.interestsHeading}</h2><div>{profile.interests.map(([name,description],i) => <article key={name}><span aria-hidden="true">{i === 1 ? <PlaneIcon /> : ['✦','','⌘','F1'][i]}</span><h3>{name}</h3><p>{description}</p></article>)}</div></section><section className="profile-contact"><div><h2>{profile.findHeading}</h2><p>{profile.findLead}</p></div><Comms/></section></div></Localized>
}
