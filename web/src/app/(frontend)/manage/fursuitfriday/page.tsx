import { translatedMetadata } from '@/lib/i18n/server'
import Localized from '@/components/Localized'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import PhotoPublish from '@/components/PhotoPublish'
import { cosConfigured } from '@/lib/cos-upload'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: "@i18n:ui.postAFursuitFriday2@", robots: { index: false, follow: false } }) }

export default async function PhotoPublishPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/manage/login')
  return <Localized><PhotoPublish configured={cosConfigured()} /></Localized>
}
