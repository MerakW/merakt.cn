import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

/** Preview routes require a verified administrator session, never just a cookie's presence. */
export async function requirePreviewAdmin() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users') notFound()
}
