import ArrowIcon from '@/components/ArrowIcon'
export function FlightImportLink() {
  return <><a href="/pit-wall" style={{ display: 'block', padding: '12px 0' }}>Pit Wall / 状态预览 <ArrowIcon direction="up-right" /></a><a href="/manage/security" style={{ display: 'block', padding: '12px 0' }}>通行密钥 <ArrowIcon direction="up-right" /></a><a href="/manage/fursuitfriday" style={{ display: 'block', padding: '12px 0' }}>发一条毛五 <ArrowIcon direction="up-right" /></a><a href="/manage/import" style={{ display: 'block', padding: '12px 0' }}>导入 / 补齐 Flighty <ArrowIcon direction="up-right" /></a></>
}

export function PasskeyLoginLink() {
  return <p style={{ textAlign: 'center', marginBottom: 24 }}><a href="/manage/login">使用通行密钥登录 <ArrowIcon direction="up-right" /></a></p>
}
