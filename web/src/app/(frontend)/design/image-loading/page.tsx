import { notFound } from 'next/navigation'
import ImageLoadingPreview from '@/components/ImageLoadingPreview'

export const dynamic = 'force-dynamic'
export const metadata = { title: '图片加载预览', robots: { index: false, follow: false } }

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <ImageLoadingPreview />
}
