import Localized from '@/components/admin/AdminLocalized'
import ArrowIcon from '@/components/ArrowIcon'
export function FlightImportLink() {
  return <Localized><><a href="/manage/maintenance" style={{ display: 'block', padding: '12px 0' }}>{"@i18n:admin.maintenance.title@"}<ArrowIcon direction="up-right" /></a><a href="/pit-wall" style={{ display: 'block', padding: '12px 0' }}>{"@i18n:ui.pitWallStatusPreview@ "}<ArrowIcon direction="up-right" /></a><a href="/manage/security" style={{ display: 'block', padding: '12px 0' }}>{"@i18n:ui.passkeys@ "}<ArrowIcon direction="up-right" /></a><a href="/manage/fursuitfriday" style={{ display: 'block', padding: '12px 0' }}>{"@i18n:ui.postAFursuitFriday2@ "}<ArrowIcon direction="up-right" /></a><a href="/manage/import" style={{ display: 'block', padding: '12px 0' }}>{"@i18n:ui.importBackfillFlighty@ "}<ArrowIcon direction="up-right" /></a></></Localized>
}

export function PasskeyLoginLink() {
  return <Localized><p style={{ textAlign: 'center', marginBottom: 24 }}><a href="/manage/login">{"@i18n:ui.signInWithAPasskey@ "}<ArrowIcon direction="up-right" /></a></p></Localized>
}
