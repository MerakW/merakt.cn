import { requirePreviewAdmin } from '@/lib/preview-access'

export const metadata = { robots: { index: false, follow: false } }
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePreviewAdmin()
  return children
}
