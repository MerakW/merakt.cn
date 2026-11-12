import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const directory = await mkdtemp(join(tmpdir(), 'merak-photographers-'))
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), FLIGHT_SYNC_ENABLED: '0' })
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { publicAlbum } = await import('../src/lib/gallery')
const { default: PhotoGallery } = await import('../src/components/PhotoGallery')
const { default: HomeGallery } = await import('../src/components/HomeGallery')
const { LocaleProvider } = await import('../src/components/Localized')
const payload = await getPayload({ config })
try {
  const media = await payload.create({ collection: 'media', filePath: resolve('public/identity/merak-avatar.webp'), data: { alt: 'Fixture', credit: '@MediaOnly', visibility: 'public' } })
  const album = await payload.create({ collection: 'albums', data: { title: 'Fixture', slug: 'fixture-people', date: '2026-11-12', description: '📷 @FurryPorridge', photos: [{ image: media.id, caption: '📷 我\n🥩 我' }, { image: media.id, credit: '@Second' }], _status: 'published' } })
  const people = await payload.find({ collection: 'photographers', pagination: false })
  const original = people.docs.find(person => person.name === '熙帆')!
  const self = people.docs.find(person => person.isSelf)!
  const second = people.docs.find(person => person.name === 'Second')!
  assert.ok(original.id && self.id && second.id)
  await payload.update({ collection: 'photographers', id: original.id, data: { name: 'New Full Name', url: 'https://example.com/renamed' } })
  await payload.update({ collection: 'photographers', id: self.id, data: { url: 'https://example.com/self' } })
  await payload.update({ collection: 'photographers', id: second.id, data: { name: 'New Full Name', url: 'https://example.com/second' } })
  const again = await payload.create({ collection: 'albums', data: { title: 'Again', slug: 'fixture-again', cover: media.id, description: '📷 @FurryPorridge', _status: 'published' } })
  assert.deepEqual(again.photographers?.map(person => typeof person === 'number' ? person : person.id), [original.id])
  const fallback = await payload.create({ collection: 'albums', data: { title: 'Media', slug: 'fixture-media', cover: media.id, _status: 'published' } })
  assert.ok(fallback.photographers?.length)
  const records = await Promise.all([album.id, again.id].map(id => payload.findByID({ collection: 'albums', id, depth: 1 })))
  const gallery = records.map(record => publicAlbum(record)!)
  assert.equal(gallery[0].photos[1].photographers?.[0].id, second.id)
  const html = renderToStaticMarkup(h(LocaleProvider, { locale: 'zh-CN' }, h(PhotoGallery, { albums: gallery })))
  assert.match(html, /https:\/\/example.com\/renamed/)
  assert.match(html, /https:\/\/example.com\/self/)
  assert.match(html, /https:\/\/example.com\/second/)
  const thanks = html.split('class="ff-thanks"')[1].split('class="ff-end-legal"')[0]
  assert.equal(thanks.split('New Full Name').length - 1, 2)
  assert.match(html, /自拍/)
  assert.doesNotMatch(html, /<button[^>]*>(?:(?!<\/button>)[\s\S])*<a[\s>]/)
  for (const side of html.matchAll(/<div class="ff-side-label" aria-hidden="true">([\s\S]*?)<\/div>/g)) assert.doesNotMatch(side[1], /<a[\s>]/)
  assert.doesNotMatch(html.split('<div class="ff-still"')[1].split('<div class="ff-rows"')[0], /<a[\s>]/)
  const home = renderToStaticMarkup(h(LocaleProvider, { locale: 'zh-CN' }, h(HomeGallery, { albums: gallery, total: 2 })))
  assert.match(home, /https:\/\/example.com\/self/)
  assert.doesNotMatch(home, /<a[^>]*>(?:(?!<\/a>)[\s\S])*<a[\s>]/)
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.com']) await assert.rejects(payload.update({ collection: 'photographers', id: original.id, data: { url } }))
  await assert.rejects(payload.delete({ collection: 'photographers', id: second.id }))
  await assert.rejects(payload.create({ collection: 'photographers', overrideAccess: false, data: { name: 'Anonymous', key: 'anonymous' } }))
  await payload.update({ collection: 'albums', id: again.id, data: { photographers: [] } })
  await payload.update({ collection: 'albums', id: again.id, data: { title: 'Still cleared' } })
  const cleared = await payload.findByID({ collection: 'albums', id: again.id, depth: 1 })
  assert.deepEqual(cleared.photographers, [])
  const clearedPublic = publicAlbum(cleared)!
  assert.deepEqual(clearedPublic.photos[0].photographers, [])
  const clearedHTML = renderToStaticMarkup(h(LocaleProvider, { locale: 'zh-CN' }, h(PhotoGallery, { albums: [clearedPublic] })))
  assert.doesNotMatch(clearedHTML, /https:\/\/example.com\/renamed/)
  console.log('PASS: legacy aliases, rename/reuse, full names, duplicate display names, per-photo thanks, self links, media credits, safe URLs, authenticated writes and referenced deletion')
} finally { await payload.destroy() }
