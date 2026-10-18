import { getPayload } from 'payload'
import config from '@payload-config'
import { getLocale } from '@/lib/i18n/server'
import { maintenanceHTML } from '@/lib/i18n/maintenance'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'
export async function GET() {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: false })
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  if (settings.trackMode !== 'pit') return new Response(null, { status: 204, headers })
  const template = await readFile(join(process.cwd(), 'scripts/maintenance/in-pit.html'), 'utf8')
    .catch(() => readFile(join(process.cwd(), 'maintenance/in-pit.html'), 'utf8'))
  const expectedExit = settings.maintenanceExpectedExit
  const retry = expectedExit ? Math.max(30, Math.ceil((Date.parse(expectedExit) - Date.now()) / 1000)) : 120
  return new Response(maintenanceHTML(template, await getLocale(), { startedAt: settings.maintenanceStartedAt, expectedExit, manual: true }), {
    status: 503, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': String(retry) },
  })
}
