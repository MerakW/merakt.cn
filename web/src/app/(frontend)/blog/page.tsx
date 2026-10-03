import TitleReveal from '@/components/TitleReveal'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: '航行日志' }
export default async function BlogPage() {
  const payload = await getPayload({ config })
  const { docs, totalDocs } = await payload.find({ collection: 'posts', overrideAccess: false, depth: 0, sort: '-date', pagination: false })
  return <div className="journal-page"><header className="journal-heading"><p className="kicker">MERAK / LOGBOOK</p><h1><TitleReveal text="NOTES" /><br /><em><TitleReveal text="ALONG THE WAY." /></em></h1><div><p>有空、有心情的话，可能就会写一篇。</p><span>{String(totalDocs).padStart(2,'0')} 篇日志</span></div></header><div className="journal-index">{docs.map((post,index) => <Link href={`/blog/${post.slug}`} className="journal-entry" key={post.id}><span className="journal-number">{String(docs.length-index).padStart(2,'0')}</span><div><span className="journal-date">{post.date.slice(0,10).replaceAll('-','.')} · {post.category}</span><h2>{post.title}</h2><p>{post.excerpt}</p></div><span className="journal-open">翻开</span></Link>)}</div>{!docs.length && <p>还没有公开的文章。</p>}</div>
}
