export function FlightImportLink() {
  return <><a href="/manage/security" style={{ display: 'block', padding: '12px 0' }}>通行密钥 ↗</a><a href="/manage/fursuitfriday" style={{ display: 'block', padding: '12px 0' }}>发一条毛五 ↗</a><a href="/manage/import" style={{ display: 'block', padding: '12px 0' }}>导入 Flighty CSV ↗</a></>
}

export function PasskeyLoginLink() {
  return <p style={{ textAlign: 'center', marginBottom: 24 }}><a href="/manage/login">使用通行密钥登录 ↗</a></p>
}
