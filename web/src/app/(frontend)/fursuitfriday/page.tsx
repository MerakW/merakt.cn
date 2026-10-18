import { translatedMetadata } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
import PhotoGallery from '@/components/PhotoGallery'
import { getGallery } from '@/lib/gallery-server'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: "@i18n:nav.fursuitFriday@", description: "@i18n:ui.meraksFursuitFriday@" }) }
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const [albums, params] = await Promise.all([getGallery(await getLocale()), searchParams])
  return <Localized><PhotoGallery albums={albums} initialSlug={params.album} /></Localized>
}
