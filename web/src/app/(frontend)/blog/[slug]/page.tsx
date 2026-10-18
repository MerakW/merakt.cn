import { getLocale, getTranslator } from '@/lib/i18n/server'
import { translatedPost } from '@/lib/i18n/content'
import Localized from '@/components/Localized'
import { imageURL } from '@/lib/assets'
import TyreCompound from '@/components/TyreCompound'
import { compoundFor, readingLabel, richTextContent } from '@/lib/paddock'
import TitleReveal from '@/components/TitleReveal'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { Media } from '@/payload-types'
import { publicPhoto } from '@/lib/gallery'

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: ({ node }) => {
    if (node.relationTo !== 'media' || typeof node.value !== 'object') return null
    const photo = publicPhoto(node.value as Media)
    if (!photo) return null
    if (photo.video) return <Localized><a href={photo.src}>{photo.alt}</a></Localized>
    const alt = typeof node.fields?.alt === 'string' ? node.fields.alt : photo.alt
    return <Localized><img data-i18n="off" src={photo.display} srcSet={photo.srcSet} sizes="(max-width: 900px) 100vw, 900px" width={photo.width} height={photo.height} alt={alt} loading="lazy" /></Localized>
  },
})
export const dynamic = 'force-dynamic'
async function getPost(slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'posts', overrideAccess: false, depth: 1, where: { slug: { equals: slug } }, limit: 1 })
  return result.docs[0] && translatedPost(result.docs[0], await getLocale())
}
export async function generateMetadata({ params }: { params: Promise<{slug: string}> }) {
  const post = await getPost((await params).slug)
  const t = await getTranslator()
  return { title: post?.title || t("ui.articleNotFound"), description: post?.excerpt || undefined, openGraph: { title: post?.title || t("ui.articleNotFound"), description: post?.excerpt || t("ui.meraksLogbook"), type: 'article', url: `https://merakt.cn/blog/${encodeURIComponent((await params).slug)}`, images: [{url:imageURL('/social/paddock-og.png'),width:1200,height:630}], ...(post?{publishedTime:post.date,modifiedTime:post.updatedAt}:{}) }, twitter: {card:'summary_large_image',title:post?.title,description:post?.excerpt||undefined,images:[imageURL('/social/paddock-og.png')]} }
}
export default async function PostPage({ params }: { params: Promise<{slug: string}> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  return <Localized><article className="journal-post"><Link className="quiet-link" href="/blog">{"@i18n:blog.back@"}</Link><header><p className="kicker">{post.date.slice(0,10).replaceAll('-','.')} / {readingLabel(richTextContent(post.body))}</p><TyreCompound compound={compoundFor(richTextContent(post.body),post.compound)}/><h1 data-i18n="off"><TitleReveal text={post.title} translateText={false} /></h1>{post.excerpt && <p data-i18n="off">{post.excerpt}</p>}</header><div data-i18n="off"><RichText converters={converters} data={post.body} className="journal-body" /></div><footer><Link href="/blog">{"@i18n:blog.readMore@"}</Link></footer></article></Localized>
}
