import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import sharp from 'sharp'
import { cosConfigured, uploadPhotoToCOS } from '@/lib/cos-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const MAX_BYTES = 30 * 1024 * 1024
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return json({ error: '请先登录管理后台。' }, 401)
  if (request.headers.get('origin') !== new URL(payload.config.serverURL).origin) {
    return json({ error: '请从本站管理页面上传。' }, 403)
  }
  if (!cosConfigured()) return json({ error: '图片上传服务尚未配置。' }, 503)
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.startsWith('multipart/form-data;')) return json({ error: '请选择图片并填写文案。' }, 415)
  const reader = request.body?.getReader()
  if (!reader) return json({ error: '未收到图片。' }, 400)
  let form: FormData
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES + 64 * 1024) { await reader.cancel(); return json({ error: '图片不能超过 30 MB。' }, 413) }
      chunks.push(value)
    }
    form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': contentType } }).formData()
  } catch { return json({ error: '无法读取上传内容，请重新选择图片。' }, 400) }
  const file = form.get('image')
  const caption = String(form.get('caption') || '').trim()
  const date = String(form.get('date') || '')
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) return json({ error: '请选择一张 30 MB 以内的图片。' }, 400)
  if (!caption || caption.length > 10_000) return json({ error: '请填写 1–10,000 字的文案。' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return json({ error: '记录日期无效。' }, 400)
  }
  const original = Buffer.from(await file.arrayBuffer())
  const id = createHash('sha256').update(original).update('\0' + caption + '\0' + date).digest('hex').slice(0, 32)
  const slug = 'photo-' + id
  const existing = await payload.find({ collection: 'albums', user, overrideAccess: false, depth: 0, limit: 1, where: { slug: { equals: slug } } })
  if (existing.docs[0]) return json({ url: `/fursuitfriday?album=${slug}`, duplicate: true })
  let image: Buffer
  try {
    const input = sharp(original, { limitInputPixels: 40_000_000, failOn: 'error' })
    const metadata = await input.metadata()
    if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format || '') || (metadata.pages || 1) > 1) {
      return json({ error: '请选择静态 JPG、PNG、WebP 或 AVIF 图片。' }, 415)
    }
    // sharp strips metadata by default. rotate() applies EXIF orientation first.
    image = await input.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  } catch { return json({ error: '图片无法处理，或超过 4,000 万像素。请换一张图片。' }, 400) }
  const key = `fursuitfriday/upload-${id}.webp`
  try { await uploadPhotoToCOS(key, image) }
  catch (error) { return json({ error: error instanceof Error ? error.message : '图片上传失败，未发布相册。' }, 502) }
  const title = caption.split('\n')[0].slice(0, 100)
  const credit = caption.match(/(?:📷|摄影)\s*[：:]\s*([^\n]+)/)?.[1]?.trim()
  const legacyPath = '/images/' + key
  let transactionID: string | number | null
  try { transactionID = await payload.db.beginTransaction() }
  catch { return json({ error: '图片已上传，但后台暂时无法保存。请重试。' }, 503) }
  if (transactionID == null) return json({ error: '图片已上传，但后台暂时无法保存。请重试。' }, 503)
  const req = { transactionID, user }
  try {
    const media = await payload.create({ collection: 'media', user, overrideAccess: false, req,
      file: { data: image, name: `upload-${id}.webp`, mimetype: 'image/webp', size: image.length },
      data: { alt: title, credit, visibility: 'public', legacyPath } })
    await payload.create({ collection: 'albums', user, overrideAccess: false, req,
      data: { title, slug, date, description: caption, photographer: credit, cover: media.id,
        photos: [{ image: media.id, caption, credit }], _status: 'published' } })
    await payload.db.commitTransaction(transactionID)
    return json({ url: `/fursuitfriday?album=${slug}`, bytes: image.length })
  } catch {
    await payload.db.rollbackTransaction(transactionID)
    return json({ error: '图片已上传，但相册保存失败。请重试；相同图片、文案和日期不会重复发布。' }, 500)
  }
}
