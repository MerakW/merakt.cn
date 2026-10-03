import TitleReveal from '@/components/TitleReveal'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RichText } from '@payloadcms/richtext-lexical/react'
export const dynamic = 'force-dynamic'
async function getPost(slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'posts', overrideAccess: false, depth: 1, where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0]
}
export async function generateMetadata({ params }: { params: Promise<{slug: string}> }) {
  const post = await getPost((await params).slug)
  return { title: post?.title || '文章未找到', description: post?.excerpt || undefined }
}
export default async function PostPage({ params }: { params: Promise<{slug: string}> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  return <article className="journal-post"><Link className="quiet-link" href="/blog">返回航行日志</Link><header><p className="kicker">{post.date.slice(0,10).replaceAll('-','.')} / {post.category}</p><h1><TitleReveal text={post.title} /></h1>{post.excerpt && <p>{post.excerpt}</p>}</header><RichText data={post.body} className="journal-body" /><footer><Link href="/blog">继续翻翻其他文章</Link></footer></article>
}
