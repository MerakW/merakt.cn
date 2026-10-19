import type { CollectionSlug, PayloadRequest } from 'payload'

/** Restrict reusable values to explicit editor fields; never expose private records. */
export function savedValueOptions(collection: CollectionSlug, fields: readonly string[]) {
  return async (req: PayloadRequest): Promise<Response> => {
    const headers = { 'Cache-Control': 'private, no-store' }
    if (!req.user) return Response.json({ error: '请先登录后台。' }, { status: 401, headers })
    const path = new URL(req.url!).searchParams.get('field') || ''
    if (!fields.includes(path)) return Response.json({ error: '无效字段。' }, { status: 400, headers })
    const result = await req.payload.findDistinct({ collection, field: path, limit: 0, overrideAccess: false, req })
    const options = [...new Set(result.values.map(row => (row as Record<string, unknown>)[path])
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    return Response.json({ options }, { headers })
  }
}
export const mediaSavedFields = ['exposure.camera', 'exposure.lens', 'exposure.filmStock', 'credit'] as const
export const flightSavedFields = ['aircraft', 'aircraftCode', 'airline', 'registration', 'flightNumber', 'from', 'to', 'divertedTo'] as const
export const albumSavedFields = ['photographer'] as const
