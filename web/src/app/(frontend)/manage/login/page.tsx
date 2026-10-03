import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import TerminalLogin from '@/components/TerminalLogin'
export const dynamic = 'force-dynamic'
export const metadata = { title: '身份验证', robots: { index: false, follow: false } }
export default async function LoginPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user) redirect('/manage')
  return <TerminalLogin />
}
