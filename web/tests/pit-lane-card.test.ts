import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TICKET_PATTERN, formatCard, githubFileURL, githubIssueURL, mailtoURL, parseCard, toYaml, type Application } from '../src/lib/pit-lane-card'

const app: Application = { tla: 'AST', name: "Aster's Hangar", url: 'https://aster.example', teamColor: '#2349ed', tyre: 'auto', bio: 'Cleared: for takeoff.', coolingMsg: '', contact: 'QQ 10000', backlinkUrl: 'https://aster.example/links' }

test('clearance card round-trips through every text channel', () => {
  const card = formatCard(app)
  assert.match(card, /三字码 TLA: AST/)
  assert.match(card, /留言 MESSAGE: —/)
  assert.deepEqual(parseCard(card), { tla: 'AST', name: "Aster's Hangar", url: 'https://aster.example/', teamColor: '#2349ed', tyre: 'auto', bio: 'Cleared: for takeoff.', backlinkUrl: 'https://aster.example/links', contact: 'QQ 10000' })
  const yaml = parseCard(toYaml({ ...app, tyre: 'W' }))
  assert.equal(yaml.tyre, 'W'); assert.equal(yaml.contact, undefined); assert.equal(yaml.bio, 'Cleared: for takeoff.')
  const issue = new URL(githubIssueURL(app))
  assert.equal(parseCard(issue.searchParams.get('body')!).tla, 'AST')
  assert.equal(issue.searchParams.get('body')!.includes('QQ 10000'), false, 'issues are public')
  assert.equal(new URL(githubFileURL(app)).searchParams.get('filename'), 'friends/AST.yml')
  assert.equal(parseCard(decodeURIComponent(mailtoURL('pit@merakt.cn', app).split('body=')[1])).name, "Aster's Hangar")
})

test('free-form DMs with Chinese aliases are understood, junk is dropped', () => {
  const parsed = parseCard('名字：小鹰\n链接：https://eagle.example\n三字码：egl\n颜色：#FF8800\n轮胎：x\nQQ：123456\n网址：javascript:alert(1)')
  assert.deepEqual(parsed, { name: '小鹰', url: 'https://eagle.example/', tla: 'EGL', teamColor: '#ff8800', tyre: 'auto', contact: 'QQ 123456' })
  assert.deepEqual(parseCard('三字码: TOOLONG\n涂装色: red'), {})
  assert.equal(parseCard('轮胎 TYRE: U').tyre, 'auto', 'purple ultra is MRK-only')
})

test('repo template parses and tickets have an unambiguous alphabet', () => {
  const template = parseCard(readFileSync(new URL('../../friends/_template.yml', import.meta.url), 'utf8'))
  assert.equal(template.tla, 'AST'); assert.equal(template.teamColor, '#2349ed'); assert.equal(template.coolingMsg, undefined)
  assert.ok(TICKET_PATTERN.test('PIT-AST-7K3QZ9'))
  assert.ok(!TICKET_PATTERN.test('PIT-AST-7K3QZ0'))
  assert.ok(!TICKET_PATTERN.test('PIT-AS-7K3QZ9'))
})

test('reciprocal link check wants an anchor to merakt.cn', async () => {
  const { verifyBacklink } = await import('../src/lib/pit-lane-monitor')
  assert.equal(await verifyBacklink([], '<li><a class="x" href="https://merakt.cn/">Merak</a></li>'), true)
  assert.equal(await verifyBacklink([], "<a href='//www.merakt.cn'>"), true)
  assert.equal(await verifyBacklink([], '<p>I like merakt.cn</p><a href="https://merakt.cn.evil.example">'), false)
})
