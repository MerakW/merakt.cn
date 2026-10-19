import test from 'node:test'
import assert from 'node:assert/strict'
import { creditParts, creditsOf, withoutCredits, publicAlbum, publicPhoto } from '../src/lib/gallery'
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

test('credits read explicit roles without inventing a photographer', () => {
  assert.deepEqual(creditsOf('“你不在”\n\n📷：@Sunian_Official \n🥩：@岁稔\n\n#FursuitFriday', '@Sunian_Official'), [
    { role: 'suiter', names: ['@岁稔'], me: false }, { role: 'photo', names: ['@Sunian_Official'], me: false },
  ])
  assert.deepEqual(creditsOf('「阅读过你的眼睛」\n🥩：@FurryPorridge'), [
    { role: 'suiter', names: ['@FurryPorridge'], me: false },
  ])
  assert.deepEqual(creditsOf('很酷\n🥩：@FurryPorridge\n🪄：我自己✌🏻\n#Fursuit #Furry'), [
    { role: 'suiter', names: ['@FurryPorridge'], me: false }, { role: 'edit', names: [], me: true },
  ])
  // Someone else's character's suiter is not Merak's, and 📷 without a colon still counts.
  assert.deepEqual(creditsOf('🐲神：@horika55\n🐲神の🥩：@Yomi_35930\n📷：@Sunian_Official @云岚', '@Sunian_Official @云岚'), [
    { role: 'photo', names: ['@Sunian_Official', '@云岚'], me: false },
  ])
  assert.deepEqual(creditsOf('我看起来胖胖的\n📷@syZPI70Mxw10059'), [{ role: 'photo', names: ['@syZPI70Mxw10059'], me: false }])
  assert.deepEqual(creditsOf('2.0 来咯🤗\n🪡&amp;📷：@Furry_July'), [
    { role: 'photo', names: ['@Furry_July'], me: false }, { role: 'maker', names: ['@Furry_July'], me: false },
  ])
  // Single-line captions, and posts with no credit at all.
  assert.deepEqual(creditsOf('「无需比较，我独我」 🥩：@妄欢 📷：@苏年'), [
    { role: 'suiter', names: ['@妄欢'], me: false }, { role: 'photo', names: ['@苏年'], me: false },
  ])
  assert.deepEqual(creditsOf('来跟我一起看海吧～'), [])
})

test('post text drops the credit lines the page shows separately', () => {
  assert.equal(withoutCredits('“你不在”\n\n📷：@Sunian_Official \n🥩：@岁稔\n\n#FursuitFriday'), '“你不在”\n\n#FursuitFriday')
  assert.equal(withoutCredits('「无需比较，我独我」 🥩：@妄欢 📷：@苏年'), '「无需比较，我独我」')
  assert.equal(withoutCredits('🐲神の🥩：@Yomi_35930'), '🐲神の🥩：@Yomi_35930')
})

test('self credits merge only when explicit, and mixed suiters retain their names', () => {
  assert.deepEqual(creditParts(creditsOf('🥩：朋友B\n📷：我\n🪄：我')).map(({roles,names,me})=>({roles,names,me})),[
    {roles:['suiter'],names:['朋友B'],me:false},{roles:['photo','edit'],names:[],me:true},
  ])
  const selfie = creditParts(creditsOf('🥩：我\n📷：我\n🪄：我'))
  assert.equal(selfie.length,1)
  assert.equal(selfie[0].selfPortrait,true)
  assert.deepEqual(selfie[0].roles,['photo','edit'])
  assert.deepEqual(creditParts(creditsOf('🥩：朋友A、我\n📷：朋友C'))[0].names,['朋友A'])
  assert.equal(creditParts(creditsOf('🥩：朋友A、我\n📷：朋友C'))[0].me,true)
  assert.deepEqual(creditsOf('摄影：@Friend\n后期：我'),[{role:'photo',names:['@Friend'],me:false},{role:'edit',names:[],me:true}])
  assert.equal(withoutCredits('正文\n摄影：@Friend\n后期：我'),'正文')
})
