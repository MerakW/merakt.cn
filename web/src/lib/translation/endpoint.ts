import type { PayloadRequest } from 'payload'
import { TranslationError, translateDraft } from './deepseek'

const active = new Set<string>()
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

export async function translationEndpoint(req: PayloadRequest): Promise<Response> {
  if (!req.user || req.user.collection !== 'users') return json({ error: '请先登录管理后台。' }, 401)
  if (req.headers.get('origin') !== new URL(req.payload.config.serverURL).origin) return json({ error: '请从本站后台提交。' }, 403)
  const actor = String(req.user.id)
  if (active.has(actor)) return json({ error: '已有翻译进行中，请稍候。' }, 429)
  active.add(actor)
  try {
    if (!req.headers.get('content-type')?.startsWith('application/json')) throw new TranslationError('请提交 JSON 数据。')
    const reader = req.body?.getReader()
    if (!reader) throw new TranslationError('缺少请求内容。')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 512_000) { await reader.cancel(); throw new TranslationError('请求内容过大。', 413) }
      chunks.push(value)
    }
    let body
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new TranslationError('JSON 格式无效。') }
    if (!body || typeof body.collection !== 'string' || !body.data || typeof body.data !== 'object' || Array.isArray(body.data) || (body.overwrite !== undefined && typeof body.overwrite !== 'boolean')) throw new TranslationError('请求格式无效。')
    if (!['posts', 'albums', 'notes', 'media', 'photo-caption'].includes(body.collection)) throw new TranslationError('此内容类型没有可翻译字段。')
    const patches = await translateDraft(body.collection, body.data, body.overwrite === true)
    return json({ patches })
  } catch (error) {
    return error instanceof TranslationError ? json({ error: error.message }, error.status) : json({ error: '翻译失败，请稍后重试。' }, 500)
  } finally { active.delete(actor) }
}
