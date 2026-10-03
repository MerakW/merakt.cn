import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import FlightImport from '@/components/FlightImport'

export const dynamic = 'force-dynamic'
export const metadata = { title: '导入飞行记录', robots: { index: false, follow: false } }

export default async function ImportPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Fmanage%2Fimport')
  return <FlightImport />
}
