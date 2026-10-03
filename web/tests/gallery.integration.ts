/** Synthetic upload / publish workflow, never writes to the real site database. */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const directory = await mkdtemp(join(tmpdir(), 'merak-gallery-'))
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.DATABASE_URL = 'file:' + join(directory, 'test.db')
process.env.MEDIA_DIR = join(directory, 'media')
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { publicAlbum } = await import('../src/lib/gallery')
const payload = await getPayload({ config })
try {
  const admin = await payload.create({ collection: 'users', data: { name: '测试', email: 'gallery@example.invalid', password: randomUUID() } })
  const user = { ...admin, collection: 'users' as const }
  const upload = await payload.create({ collection: 'media', user, overrideAccess: false, filePath: resolve('public/identity/merak-avatar.webp'), data: { alt: '测试图片', visibility: 'private' } })
  assert.equal((await payload.find({ collection: 'media', overrideAccess: false })).totalDocs, 0)
  const album = await payload.create({ collection: 'albums', user, overrideAccess: false, draft: true, data: { title: '测试毛五', date: '2026-09-30', photos: [{ image: upload.id, caption: '配文', credit: '摄影署名' }], _status: 'draft' } })
  assert.ok(album.slug.startsWith('photo-'))
  assert.equal((await payload.find({ collection: 'albums', overrideAccess: false })).totalDocs, 0)
  await payload.update({ collection: 'albums', id: album.id, user, overrideAccess: false, data: { _status: 'published' } })
  const hidden = await payload.find({ collection: 'albums', depth: 1, overrideAccess: false })
  assert.equal(publicAlbum(hidden.docs[0]), null)
  await payload.update({ collection: 'media', id: upload.id, user, overrideAccess: false, data: { visibility: 'public' } })
  const visible = await payload.find({ collection: 'albums', depth: 1, overrideAccess: false })
  assert.equal(publicAlbum(visible.docs[0])?.photos[0].caption, '配文')
  assert.equal(publicAlbum(visible.docs[0])?.photos[0].credit, '摄影署名')
  await assert.rejects(payload.create({ collection: 'media', overrideAccess: false, data: { alt: '匿名上传', visibility: 'public' }, filePath: resolve('public/identity/merak-avatar.webp') }))
  console.log('PASS: authenticated upload, generated slug, drafts, private media, publishing, caption/credit, anonymous rejection')
} finally { await payload.destroy() }
