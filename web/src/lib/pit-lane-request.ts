import type { PayloadRequest } from 'payload'

/** Errors are i18n keys; the Stewards' Desk translates them client-side. */
export const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
export const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null

export function trustedOrigin(req: PayloadRequest): boolean {
  const origin = req.headers.get('origin')
  if (origin === new URL(req.payload.config.serverURL).origin) return true
  if (process.env.LOCAL_PREVIEW !== '1' || !origin) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'http:' && url.host === req.headers.get('host') && /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname)
  } catch { return false }
}

/** Small JSON bodies only; anything else is refused before parsing. */
export async function readJSON(req: PayloadRequest, limit: number): Promise<Record<string, unknown> | Response> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply('pitLane.error.format', 415)
  const reader = req.body?.getReader()
  if (!reader) return reply('pitLane.error.format', 400)
  try {
    let size = 0; const chunks: Uint8Array[] = []
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return reply('pitLane.error.tooLarge', 413) } chunks.push(value) }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : reply('pitLane.error.format', 400)
  } catch { return reply('pitLane.error.format', 400) }
}
