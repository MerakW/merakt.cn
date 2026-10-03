/** Isolated database. No real flight data or user credentials are used by these tests. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import Papa from 'papaparse'
import { importFlights } from '../src/lib/flights/import-endpoint'

const directory = resolve('.data/integration-' + randomUUID())
mkdirSync(directory, { recursive: true })
process.env.DATABASE_URL = 'file:' + directory + '/test.db'
process.env.MEDIA_DIR = directory + '/media'
Object.assign(process.env, { NODE_ENV: 'development' })
const { getPayload, createLocalReq } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
let count = 0
const check = (condition: unknown, message: string) => { assert.ok(condition, message); count++; console.log('PASS', message) }

try {
  const password = randomUUID() + randomUUID()
  const user = await payload.create({ collection: 'users', data: { email: 'integration@example.invalid', password, name: '本地验证账号' } })
  const login = await payload.login({ collection: 'users', data: { email: user.email, password } })
  check(login.token, '管理员可登录')
  const unauthorized = await payload.create({ collection: 'notes', data: { text: '不应创建', date: new Date().toISOString(), _status: 'published' }, overrideAccess: false }).then(() => false, () => true)
  check(unauthorized, '匿名请求不能写入')

  const data = { date: '2026-09-20', from: 'HGH', to: 'HND', state: 'completed' as const, departureLocal: '2026-09-20T09:00', arrivalLocal: '2026-09-20T13:00', _status: 'published' as const }
  const privateFlight = await payload.create({ collection: 'flights', data: { ...data, visibility: 'private', privateDetails: { pnr: 'TEST-ONLY-SECRET' } } })
  const publicFlight = await payload.create({ collection: 'flights', data: { ...data, visibility: 'public', privateDetails: { pnr: 'TEST-ONLY-SECRET' }, importKey: 'synthetic-id' } })
  await payload.create({ collection: 'flights', data: { ...data, visibility: 'scheduled', publishAt: '2099-01-01T00:00:00Z' } })
  await payload.create({ collection: 'flights', data: { ...data, visibility: 'public', _status: 'draft' }, draft: true })
  const visible = await payload.find({ collection: 'flights', overrideAccess: false, depth: 0, limit: 100 })
  check(visible.totalDocs === 1 && visible.docs[0].id === publicFlight.id, '匿名只看到已发布且允许公开的航段')
  check(!JSON.stringify(visible).includes('TEST-ONLY-SECRET') && !JSON.stringify(visible).includes('synthetic-id'), '公开读取剔除私有字段与导入标识')
  const hidden = await payload.findByID({ collection: 'flights', id: privateFlight.id, overrideAccess: false }).then(() => false, () => true)
  check(hidden, '通过记录 ID 也不能读取私有航段')
  const invalid = await payload.create({ collection: 'flights', data: { ...data, from: 'ZZZ', visibility: 'public' } }).then(() => false, () => true)
  check(invalid, '发布时拒绝未知机场')
  check(publicFlight.departureUTC === '2026-09-20T01:00:00.000Z', '后台录入使用机场时区转换')

  const draft = await payload.create({ collection: 'notes', data: { text: '草稿一', date: new Date().toISOString(), _status: 'draft' }, draft: true })
  await payload.update({ collection: 'notes', id: draft.id, data: { text: '发布版本', _status: 'published' } })
  const versions = await payload.findVersions({ collection: 'notes', where: { parent: { equals: draft.id } } })
  check(versions.totalDocs >= 2, '草稿与发布修改保存历史版本')
  const original = versions.docs.find(v => v.version.text === '草稿一')
  assert.ok(original)
  await payload.restoreVersion({ collection: 'notes', id: original.id })
  const restored = await payload.findByID({ collection: 'notes', id: draft.id, draft: true })
  check(restored.text === '草稿一', '历史版本可恢复')

  const csvRow = { Date: '2026-09-21', From: 'HGH', To: 'HND', 'Flight Flighty ID': 'import-test-one', PNR: 'IMPORT-SECRET', 'Gate Arrival (Actual)': '2026-09-21T13:00' }
  const invokeImport = async (rows: Record<string, string>[], action = 'preview', authenticated = true, origin = payload.config.serverURL) => {
    const request = new Request(payload.config.serverURL + '/api/flights/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ csv: Papa.unparse(rows), action }) })
    const req = await createLocalReq({ user: authenticated ? { ...user, collection: 'users' } : undefined }, payload)
    Object.assign(req, { headers: request.headers, body: request.body })
    return importFlights(req)
  }
  check((await invokeImport([csvRow], 'commit', false)).status === 401, '导入接口拒绝未登录用户')
  check((await invokeImport([csvRow], 'commit', true, 'https://untrusted.invalid')).status === 403, '导入接口拒绝跨站提交')
  const countBeforePreview = (await payload.count({ collection: 'flights' })).totalDocs
  const previewResponse = await invokeImport([csvRow, csvRow])
  const previewResult = await previewResponse.json()
  check(previewResult.flights.length === 1 && previewResult.duplicates.length === 1 && !JSON.stringify(previewResult).includes('IMPORT-SECRET'), '导入预览提示重复且不回显订票信息')
  check((await payload.count({ collection: 'flights' })).totalDocs === countBeforePreview, '预览不写入数据库')
  const committed = await (await invokeImport([csvRow, csvRow], 'commit')).json()
  check(committed.imported === 1, 'CSV 批次通过事务写入')
  const imported = await payload.find({ collection: 'flights', where: { importKey: { equals: 'flighty:import-test-one' } } })
  check(imported.docs[0].visibility === 'private' && (imported.docs[0].privateDetails as { pnr: string }).pnr === 'IMPORT-SECRET', '新导入默认为私有且完整保留私有信息')
  check((await (await invokeImport([csvRow], 'commit')).json()).imported === 0, '重复提交同一文件不增加记录')
  const failed = await invokeImport([{ ...csvRow, 'Flight Flighty ID': 'import-test-two' }, { ...csvRow, 'Flight Flighty ID': 'import-test-invalid', To: 'ZZZ' }], 'commit')
  check(failed.status === 422 && (await payload.find({ collection: 'flights', where: { importKey: { equals: 'flighty:import-test-two' } } })).totalDocs === 0, '一行无效时整个导入批次不写入')

  // Inject a real mid-batch storage failure to verify rollback after the first create.
  const create = payload.create.bind(payload)
  let writes = 0
  payload.create = (async (...args: Parameters<typeof payload.create>) => {
    if (++writes === 2) throw new Error('synthetic storage failure')
    return create(...args)
  }) as typeof payload.create
  let rollbackResponse: Response
  try {
    rollbackResponse = await invokeImport([{ ...csvRow, 'Flight Flighty ID': 'rollback-one' }, { ...csvRow, 'Flight Flighty ID': 'rollback-two' }], 'commit')
  } finally { payload.create = create }
  check(rollbackResponse!.status === 409 && (await payload.find({ collection: 'flights', where: { importKey: { equals: 'flighty:rollback-one' } } })).totalDocs === 0, '写入中途失败时已写入航段也整体回滚')

  const beforeRestart = await payload.count({ collection: 'flights' })
  await payload.destroy()
  const reopened = execFileSync(process.execPath, ['--import', 'tsx', 'tests/cms-reopen.ts'], {
    env: { ...process.env, EXPECTED_FLIGHTS: String(beforeRestart.totalDocs) }, encoding: 'utf8',
  })
  check(reopened.includes('REOPEN_OK'), '新进程启动后数据库内容保留')
  console.log(JSON.stringify({ passed: count, isolatedDatabase: directory }))
} finally {
  await payload.destroy()
}
