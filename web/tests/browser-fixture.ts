// Disposable, isolated localhost QA fixture. Never use these credentials on a real site.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const directory = resolve('.data/browser-qa')
mkdirSync(directory, { recursive: true })
process.env.DATABASE_URL = 'file:' + directory + '/test.db'
process.env.MEDIA_DIR = directory + '/media'
Object.assign(process.env, { NODE_ENV: 'development' })
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const email = 'browser-qa@example.invalid'
  const users = await payload.find({ collection: 'users', where: { email: { equals: email } } })
  if (!users.totalDocs) await payload.create({ collection: 'users', data: { email, password: 'Local-QA-only-2026!', name: '本机测试账号' } })
  writeFileSync(directory + '/sample.csv', 'Date,From,To,Flight,Flight Flighty ID,Gate Arrival (Actual),PNR\n2026-09-21,HGH,HND,QA101,browser-one,2026-09-21T13:00,SYNTHETIC-PRIVATE\n2026-09-21,HGH,HND,QA101,browser-one,2026-09-21T13:00,SYNTHETIC-PRIVATE\n2026-09-22,HND,HGH,QA102,browser-two,,\n', { mode: 0o600 })
  console.log('隔离的浏览器测试数据已准备：.data/browser-qa（不含真实个人记录）。')
} finally { await payload.destroy() }
