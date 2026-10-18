import { localizedCard } from '@/lib/i18n/card'
import { getLocale } from '@/lib/i18n/server'
export async function GET() {
  const locale = await getLocale()
  return new Response(localizedCard(locale), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Language': locale, 'Cache-Control': 'private, no-store', Vary: 'Cookie, Accept-Language' } })
}
