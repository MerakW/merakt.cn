import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { translateDraft } from '../src/lib/translation/deepseek'
import { translationPlan, translationSnapshot } from '../src/lib/translation/fields'
import { translationEndpoint } from '../src/lib/translation/endpoint'

test('translation preserves nested records and existing English by default', () => {
  const data = { title: '标题', titleEn: 'Existing', description: '配文', photos: [{ id: 'a', image: 9, caption: '一' }, { id: 'b', caption: '二', captionEn: 'Two' }] }
  const plan = translationPlan('albums', data)
  assert.deepEqual(plan.items.map(item => item.source), ['配文', '一'])
  plan.items.forEach(item => item.apply('English'))
  assert.deepEqual(plan.patches, [{ path: 'descriptionEn', value: 'English' }, { path: 'photos.0.captionEn', value: 'English' }])
  assert.equal(data.titleEn, 'Existing')
  assert.equal(translationPlan('albums', data, true).items.length, 4)
  assert.deepEqual(translationPlan('notes', { text: '近况', radioMessages: [{ message: '回复', speaker: 'team', id: 'abc' }] }).patches.map(patch => patch.path), ['textEn', 'radioMessages.0.messageEn'])
})

test('Lexical text leaves translate without sending or modifying links, formatting or embeds', async () => {
  const body = { root: { type: 'root', version: 1, children: [{ type: 'paragraph', children: [{ type: 'text', text: '你好', format: 1 }, { type: 'link', fields: { url: 'https://example.com/private' }, children: [{ type: 'text', text: '链接', format: 2 }] }] }, { type: 'upload', value: { id: 8, alt: '不要发送', url: '/private.jpg' } }, { type: 'block', fields: { blockType: 'album', album: 7 } }] } }
  let calls = 0
  const patches = await translateDraft('posts', { body }, false, { apiKey: 'test', beta: false, fetch: async (url, init) => {
    calls++
    assert.equal(url, 'https://api.deepseek.com/chat/completions')
    const request = JSON.parse(String(init?.body))
    assert.equal(String(init?.body).includes('private'), false)
    assert.deepEqual(JSON.parse(request.messages[1].content).segments, ['你好', '链接'])
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translations: ['Hello', 'Link'] }) } }] })
  } })
  const expected = structuredClone(body)
  expected.root.children[0].children![0].text = 'Hello'
  expected.root.children[0].children![1].children![0].text = 'Link'
  assert.deepEqual(patches, [{ path: 'bodyEn', value: expected }])
  assert.equal(body.root.children[0].children![0].text, '你好')
  assert.equal(calls, 1)
})

test('beta and missing keys never call provider; malformed and failed responses produce actionable errors', async () => {
  const never = async () => { throw new Error('must not call') }
  await assert.rejects(translateDraft('notes', { text: '你好' }, false, { apiKey: 'test', betaApiKey: '', beta: true, fetch: never }), /Beta/)
  await assert.rejects(translateDraft('notes', { text: '你好' }, false, { apiKey: '', beta: false, fetch: never }), /DEEPSEEK_API_KEY/)
  await assert.rejects(translateDraft('notes', { text: '你好' }, false, { apiKey: 'test', beta: false, fetch: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"translations":["Hello"]}' } }] }) }), /不完整/)
  await assert.rejects(translateDraft('notes', { text: '你好' }, false, { apiKey: 'test', beta: false, fetch: async () => new Response('', { status: 401 }) }), /密钥无效/)
  await assert.rejects(translateDraft('notes', { text: '你'.repeat(9000) }, false, { apiKey: 'test', beta: false, fetch: never }), /8000/)
})

test('translation endpoint requires administrator and same origin before reading content', async () => {
  const req = { user: null, headers: new Headers(), payload: { config: { serverURL: 'https://example.com' } } } as unknown as PayloadRequest
  assert.equal((await translationEndpoint(req)).status, 401)
  req.user = { id: 1, collection: 'users' } as PayloadRequest['user']
  req.headers.set('origin', 'https://other.example.com')
  assert.equal((await translationEndpoint(req)).status, 403)
  req.headers.set('origin', 'https://example.com')
  assert.equal((await translationEndpoint(req)).status, 400)
})

test('beta opt-in uses only its independent credential', async () => {
  let key = ''
  await translateDraft('photo-caption', { caption: '你好' }, false, { apiKey: 'production-secret', betaApiKey: 'beta-secret', beta: true, fetch: async (_url, init) => {
    key = new Headers(init?.headers).get('Authorization') || ''
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"translations":["Hello"]}' } }] })
  } })
  assert.equal(key, 'Bearer beta-secret')
})

test('existing embed-only English body survives and autosave metadata does not invalidate preview', () => {
  for (const type of ['upload', 'block', 'relationship']) {
    const plan = translationPlan('posts', { body: { root: { children: [{ type: 'text', text: '中文' }] } }, bodyEn: { root: { children: [{ type, value: 1 }] } } })
    assert.equal(plan.items.length, 0)
    assert.equal(plan.patches.length, 0)
  }
  const data = { title: '中文', titleEn: '', updatedAt: 'before', photos: [{ id: 'a', caption: '一' }, { id: 'b', caption: '二' }] }
  assert.equal(translationSnapshot('albums', data), translationSnapshot('albums', { ...data, updatedAt: 'after' }))
  assert.notEqual(translationSnapshot('albums', data), translationSnapshot('albums', { ...data, photos: [...data.photos].reverse() }))
  assert.notEqual(translationSnapshot('albums', data), translationSnapshot('albums', { ...data, titleEn: 'Manual edit' }))
})

test('code blocks and inline code remain unchanged', () => {
  const code = { root: { children: [{ type: 'code', children: [{ type: 'text', text: 'const 中文 = 1' }] }, { type: 'text', format: 16, text: '变量' }, { type: 'text', text: '说明' }] } }
  const plan = translationPlan('posts', { body: code })
  assert.deepEqual(plan.items.map(item => item.source), ['说明'])
  plan.items[0].apply('Description')
  assert.deepEqual(plan.patches[0].value, { root: { children: [code.root.children[0], code.root.children[1], { type: 'text', text: 'Description' }] } })
})
