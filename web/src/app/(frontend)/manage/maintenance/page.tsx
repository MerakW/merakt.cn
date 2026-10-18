import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import Localized from '@/components/Localized'
import { translatedMetadata } from '@/lib/i18n/server'
import { beijingInput, recoveryTime } from '@/lib/maintenance-time'

export const dynamic = 'force-dynamic'
export async function generateMetadata() { return translatedMetadata({ title: '@i18n:admin.maintenance.title@', robots: { index: false, follow: false } }) }

async function save(form: FormData) {
  'use server'
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/manage/login')
  let expected: string | null
  try { expected = recoveryTime(String(form.get('expected') || '')) }
  catch { redirect('/manage/maintenance?error=time') }
  const settings = await payload.findGlobal({ slug: 'site-settings', overrideAccess: false, user, depth: 0 })
  const active = form.get('active') === 'on'
  await payload.updateGlobal({ slug: 'site-settings', overrideAccess: false, user, data: {
    trackMode: active ? 'pit' : settings.trackMode === 'pit' ? 'auto' : settings.trackMode,
    maintenanceExpectedExit: active ? expected : null,
  } })
  revalidatePath('/', 'layout')
  redirect('/manage/maintenance?saved=1')
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/manage/login')
  const [settings, query] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', overrideAccess: false, user, depth: 0 }), searchParams,
  ])
  const active = settings.trackMode === 'pit'
  return <Localized><div className="manage-home maintenance-settings">
    <p className="kicker">MERAK / RACE CONTROL</p><h1>{'@i18n:admin.maintenance.title@'}</h1>
    <p role="status">{active ? '@i18n:admin.maintenance.stateOn@' : '@i18n:admin.maintenance.stateOff@'}</p>
    {query.saved && <p role="status">{'@i18n:admin.maintenance.saved@'}</p>}
    {query.error && <p role="alert">{'@i18n:admin.maintenance.invalid@'}</p>}
    <form action={save}>
      <label className="maintenance-toggle"><input type="checkbox" name="active" defaultChecked={active}/>{'@i18n:admin.maintenance.enable@'}</label>
      <label htmlFor="expected">{'@i18n:admin.maintenance.expectedExit@'} · UTC+8</label>
      <input id="expected" name="expected" type="datetime-local" defaultValue={beijingInput(settings.maintenanceExpectedExit || new Date().toISOString())} aria-describedby="maintenance-help"/>
      <p id="maintenance-help">{'@i18n:admin.maintenance.timezone@'}</p>
      <button type="submit">{'@i18n:admin.maintenance.save@'}</button>
    </form>
    <p><a href="/admin/globals/site-settings">{'@i18n:ui.siteSettings@'} ↗</a> · <a href="/pit-wall">PIT WALL ↗</a></p>
  </div></Localized>
}
