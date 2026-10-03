import PhotoGallery from '@/components/PhotoGallery'
import { getGallery } from '@/lib/gallery-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: '毛五', description: '是米拉克的毛五。' }
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const [albums, params] = await Promise.all([getGallery(), searchParams])
  return <PhotoGallery albums={albums} initialSlug={params.album} />
}
