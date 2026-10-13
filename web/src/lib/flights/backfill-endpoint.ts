import type { PayloadRequest } from 'payload'
import { airportMap } from './airports'
import { actualTimeLabels, previewFlightyBackfill } from './backfill-flighty'
import type { FlightRecord } from './types'

export async function backfillFlights(req: PayloadRequest): Promise<Response> {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!req.user) return json({ error: '请先登录管理后台。' }, 401)
  if (req.headers.get('origin') !== new URL(req.payload.config.serverURL).origin) return json({ error: '请从本站管理页面操作。' }, 403)
  const action = req.url ? new URL(req.url).searchParams.get('action') : null
  if (!['preview', 'commit'].includes(action || '')) return json({ error: '操作无效。' }, 400)
  let transactionID: string | number | null | undefined
  try {
    if (action === 'commit') {
      transactionID = await req.payload.db.beginTransaction()
      if (transactionID == null) throw new Error('Transactions unavailable')
      req.transactionID = transactionID
    }
    const existing = await req.payload.find({ collection: 'flights', pagination: false, depth: 0, draft: true, overrideAccess: false, req })
    const preview = previewFlightyBackfill(existing.docs as FlightRecord[], airportMap)
    if (action === 'commit') {
      for (const update of preview.updates) await req.payload.update({ collection: 'flights', id: update.id, data: update.data,
        draft: existing.docs.find(flight => flight.id === update.id)?._status === 'draft', depth: 0, overrideAccess: false, req })
      await req.payload.db.commitTransaction(transactionID!)
      transactionID = undefined
    }
    return json({ total: preview.total, withSource: preview.withSource, updated: action === 'commit' ? preview.updates.length : undefined,
      updates: preview.updates.map(({ data, ...flight }) => ({ ...flight, fields: Object.keys(data).map(field => actualTimeLabels[field as keyof typeof actualTimeLabels]) })), issues: preview.issues })
  } catch {
    if (transactionID != null) await req.payload.db.rollbackTransaction(transactionID)
    return json({ error: '补齐未完成，本次更改已回滚。请重新预览后重试。' }, 409)
  } finally { delete req.transactionID }
}
