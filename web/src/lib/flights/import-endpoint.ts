import type { PayloadRequest } from 'payload'
import { airportMap } from './airports'
import { previewFlightyCSV } from './import-flighty'
import { publicFlight } from './public'
import type { FlightRecord, ImportPreview } from './types'

const MAX_BYTES = 2 * 1024 * 1024
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

function summary(preview: ImportPreview) {
  return {
    totalRows: preview.totalRows, valid: preview.valid,
    flights: preview.flights.map(publicFlight),
    duplicates: preview.duplicates.map(({ row, firstRow }) => ({ row, firstRow })),
    issues: preview.issues,
  }
}

// Keep uploaded CSV in memory only. The response never echoes PNR, seats or source rows.
export async function importFlights(req: PayloadRequest): Promise<Response> {
  if (!req.user) return json({ error: '请先登录管理后台。' }, 401)
  const origin = req.headers.get('origin')
  const trustedOrigin = new URL(req.payload.config.serverURL).origin
  if (origin !== trustedOrigin) return json({ error: '请从本站管理页面提交导入。' }, 403)
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: '请提交 JSON 数据。' }, 415)
  const reader = req.body?.getReader()
  if (!reader) return json({ error: '未收到文件内容。' }, 400)
  let body: { csv?: unknown; action?: unknown }
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { await reader.cancel(); return json({ error: '文件过大，请拆分为 2 MB 以内的 CSV。' }, 413) }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return json({ error: '文件内容无法读取，请重新选择。' }, 400) }
  if (!body || typeof body.csv !== 'string' || !['preview', 'commit'].includes(String(body.action))) {
    return json({ error: '请提供 CSV 和有效操作。' }, 400)
  }

  let transactionID: string | number | null | undefined
  try {
    if (body.action === 'commit') {
      transactionID = await req.payload.db.beginTransaction()
      if (transactionID == null) throw new Error('Transactions unavailable')
      req.transactionID = transactionID
    }
    const existing = await req.payload.find({ collection: 'flights', pagination: false, depth: 0, draft: true, overrideAccess: false, req })
    const preview = previewFlightyCSV(body.csv, airportMap, { existing: existing.docs as FlightRecord[] })
    if (preview.totalRows > 1000) {
      preview.valid = false
      preview.issues.push({ row: 1, code: 'too-many-rows', severity: 'error', message: '每次最多导入 1,000 行，请分批上传。' })
    }
    if (body.action === 'preview') return json(summary(preview))
    if (!preview.valid) {
      await req.payload.db.rollbackTransaction(transactionID!)
      transactionID = undefined
      return json({ ...summary(preview), error: '存在需要修正的记录，本次未写入任何航段。' }, 422)
    }
    for (const flight of preview.flights) {
      const { id: _id, ...data } = flight
      await req.payload.create({
        collection: 'flights', data: { ...data, visibility: 'private', _status: 'published' },
        depth: 0, overrideAccess: false, req,
      })
    }
    await req.payload.db.commitTransaction(transactionID!)
    transactionID = undefined
    return json({ ...summary(preview), imported: preview.flights.length })
  } catch {
    if (transactionID != null) await req.payload.db.rollbackTransaction(transactionID)
    return json({ error: '导入未完成，本次更改已回滚。请稍后重新预览，已有记录不会被覆盖。' }, 409)
  } finally {
    delete req.transactionID
  }
}
