import { airportMap } from './flights/airports'
import type { PayloadRequest } from 'payload'
const recent: number[] = []
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control':'no-store' } })
export async function submitCheckin(req: PayloadRequest) {
  if (req.headers.get('origin') !== new URL(req.payload.config.serverURL).origin) return reply('请从本站提交。',403)
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply('请求格式无效。',415)
  const reader = req.body?.getReader()
  if (!reader) return reply('没有收到留言。',400)
  let data: Record<string, unknown>
  try {
    let size = 0; const chunks: Uint8Array[] = []
    for (;;) { const {done,value} = await reader.read(); if(done) break; size += value.byteLength; if(size>8192) { await reader.cancel(); return reply('留言过长。',413) }; chunks.push(value) }
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return reply('请求无法读取。',400) }
  if (!data || typeof data !== 'object' || data.website) return reply('提交无效。',400)
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  let message = typeof data.message === 'string' ? data.message.trim() : ''
  if (data.baseAirport !== undefined) {
    const base = typeof data.baseAirport === 'string' ? data.baseAirport.trim().toUpperCase() : ''
    if (!airportMap.has(base) || message.length > 60) return reply('请选择有效的 Base 机场，短句最多 60 字。',400)
    message = `BASE ${base} → HGH${message ? '\n'+message : ''}`
  }
  if (!name || name.length > 40 || !message || message.length > 500) return reply('名字需为 1–40 字，留言需为 1–500 字。',400)
  if (data.consent !== true) return reply('请确认审核通过后可以公开名字和留言。',400)
  const now = Date.now()
  while (recent.length && recent[0] < now-60000) recent.shift()
  // Bounded per-process ceiling; persistent/proxy limits belong to deployment configuration.
  if (recent.length >= 20) return reply('当前提交较多，请稍后再试。',429)
  recent.push(now)
  try {
    await req.payload.create({ collection: 'checkins', data: { name, message, status: 'pending' }, overrideAccess: true })
    return Response.json({ accepted: true }, { status: 202, headers: { 'Cache-Control':'no-store' } })
  } catch { return reply('暂时无法保存，请稍后重试。',503) }
}
