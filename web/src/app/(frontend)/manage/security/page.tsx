import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import PasskeySettings from '@/components/PasskeySettings'

export const dynamic = 'force-dynamic'
export const metadata = { title: '通行密钥', robots: { index: false, follow: false } }
export default async function SecurityPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/manage/login')
  const keys = await payload.find({ collection: 'passkeys', depth: 0, pagination: false, where: { user: { equals: user.id } } })
  return <div className="manage-home"><p className="kicker">MERAK / IDENTITY</p><h1>通行密钥</h1><PasskeySettings initialKeys={keys.docs.map(key => ({ id: key.id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt || undefined }))} /></div>
}
