import type { PayloadRequest } from 'payload'
import { confirmProviderQuery, getProviderQuery, quoteProviderQuery } from './provider-queries'
import { readJSON, errorResponse } from './sync-endpoints'
export async function providerQueryEndpoint(req: PayloadRequest): Promise<Response> {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!req.user) return json({ error: '请先登录管理后台。' }, 401)
  if (req.headers.get('origin') !== new URL(req.payload.config.serverURL).origin) return json({ error: '请从本站后台提交。' }, 403)
  try {
    const body = await readJSON(req) as Record<string, unknown>
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '请求无效。' }, 400)
    const actor = Number(req.user.id)
    if (body.action === 'quote') return json(await quoteProviderQuery(req.payload, body, actor))
    if (body.action === 'confirm') return json(await confirmProviderQuery(req.payload, body.token, actor))
    if (body.action === 'status') return json(await getProviderQuery(req.payload, body.id))
    return json({ error: '操作无效。' }, 400)
  } catch (error) { return errorResponse(error) }
}
