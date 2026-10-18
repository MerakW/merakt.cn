import { translatedMetadata } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'
import { translatedPost } from '@/lib/i18n/content'
import Localized from '@/components/Localized'
import TyreCompound, { CompoundLegend } from '@/components/TyreCompound'
import { compoundFor, readingLabel, richTextContent } from '@/lib/paddock'
import TitleReveal from '@/components/TitleReveal'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: "@i18n:blog.title@" }) }
export default async function BlogPage() {
  const payload = await getPayload({ config })
  const { docs: originals, totalDocs } = await payload.find({ collection: 'posts', overrideAccess: false, depth: 0, sort: '-date', pagination: false })
  const locale = await getLocale()
  const docs = originals.map(post => translatedPost(post, locale))
  return <Localized><div className="journal-page"><header className="journal-heading"><p className="kicker">MERAK / LOGBOOK</p><h1><TitleReveal text="NOTES" /><br /><em><TitleReveal text="ALONG THE WAY." /></em></h1><div><p>{"@i18n:blog.intro@"}</p><span>{String(totalDocs).padStart(2,'0')} {" @i18n:ui.entries@"}</span></div></header><CompoundLegend/><div className="journal-index">{docs.map((post,index) => <Link href={`/blog/${post.slug}`} className="journal-entry" key={post.id}><TyreCompound compound={compoundFor(richTextContent(post.body),post.compound)} compact/><div><span className="journal-date">{post.date.slice(0,10).replaceAll('-','.')} · {readingLabel(richTextContent(post.body))}</span><h2 data-i18n="off">{post.title}</h2><p data-i18n="off">{post.excerpt}</p></div><span className="journal-open">{"@i18n:ui.read@"}</span></Link>)}</div>{!docs.length && <p>{"@i18n:blog.empty@"}</p>}</div></Localized>
}
