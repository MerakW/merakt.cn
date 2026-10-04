import test from 'node:test'
import assert from 'node:assert/strict'
import { publicAlbum, publicPhoto } from '../src/lib/gallery'
import type { Album, Media } from '../src/payload-types'

const media = { id: 1, visibility: 'public', filename: 'photo.jpg', alt: '照片', mimeType: 'image/jpeg', width: 2048, height: 1366 } as Media
const album = { id: 1, slug: 'test', title: '测试', _status: 'published', photos: [{ image: media }], description: '原文', date: '2025-01-17T12:00:00Z' } as Album

test('gallery never exposes draft albums or private/unpopulated media', () => {
  assert.equal(publicAlbum({ ...album, _status: 'draft' }), null)
  assert.equal(publicPhoto({ ...media, visibility: 'private' }), null)
  assert.equal(publicPhoto(1), null)
  assert.equal(publicAlbum({ ...album, photos: [{ image: { ...media, visibility: 'private' } }] }), null)
})

test('mixed albums retain only public photos and drop unsafe source links', () => {
  const result = publicAlbum({ ...album, photos: [
    { image: { ...media, visibility: 'private' } },
    { image: media, source: 'javascript:alert(1)', caption: '公开文案' },
  ] })!
  assert.equal(result.photos.length, 1)
  assert.equal(result.photos[0].source, undefined)
  assert.equal(result.photos[0].caption, '公开文案')
  assert.equal(result.date, '2025-01-17')
})

test('public media uses CDN derivatives and preserves video type', () => {
  const photo = publicPhoto({ ...media, sizes: { thumbnail: { filename: 'small photo.jpg', width: 480 }, display: { filename: 'large.jpg', width: 1440 } } })!
  assert.equal(photo.thumbnail, 'https://cos.merakt.cn/api/media/file/small%20photo.jpg')
  assert.equal(photo.srcSet, 'https://cos.merakt.cn/api/media/file/small%20photo.jpg 480w, https://cos.merakt.cn/api/media/file/large.jpg 1440w')
  assert.equal(publicPhoto({ ...media, mimeType: 'video/mp4' })!.video, true)
})
