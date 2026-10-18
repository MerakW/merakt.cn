import { chinese, type MessageKey } from '../src/lib/i18n/zh'
import { sourceText } from '../src/lib/i18n/sources'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { english } from '../src/lib/i18n/en'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translate, preferredLocale, manualTranslation, message, isMessageKey } from '../src/lib/i18n/core'
import Localized, { LocaleProvider, localizeTree } from '../src/components/Localized'
import { translatedPost } from '../src/lib/i18n/content'
import type { Post } from '../src/payload-types'

test('request locale respects the saved preference and weighted browser languages', () => {
  assert.equal(preferredLocale('zh-CN','en-US'), 'zh-CN')
  assert.equal(preferredLocale('en','zh-CN'), 'en')
  assert.equal(preferredLocale(undefined,'fr, en-GB;q=0.8,zh;q=0.5'), 'en')
  assert.equal(preferredLocale('invalid','en;q=0,zh;q=0.9'), 'zh-CN')
})
test('UI interpolation, whitespace and original fallback', () => {
  assert.equal(translate('  @i18n:flights.title@\n','en'), '  Flight log\n')
  assert.equal(translate('flights.since','en',[2025]), 'Since 2025')
  assert.equal(translate('实际出发','en'), 'Actual Departure')
  assert.equal(translate('ui.airlines','zh-CN'), '航司')
  assert.equal(translate('自定义原文','en'), '自定义原文')
})
test('server output translates text and accessibility labels without changing form values or authored text', () => {
  const output = renderToStaticMarkup(h(LocaleProvider,{locale:'en'},h(Localized,null,
    h('section',null,h('button',{'aria-label':message('airports.choose')},message('airports.choose')),
      h('select',null,h('option',null,message('flightStatus.completed'))),h('input',{value:'杭州',readOnly:true,placeholder:message('ui.aNicknameIsFine')}),
      h('p',{'data-i18n':'off'},'关于'),h('textarea',{defaultValue:'配文'})))))
  assert.match(output,/aria-label="Select airport"/)
  assert.match(output,/<option value="已完成">Completed<\/option>/)
  assert.match(output,/value="杭州"/)
  assert.match(output,/placeholder="A nickname works fine"/)
  assert.match(output,/>关于<\/p>/)
  assert.match(output,/>配文<\/textarea>/)
})
test('manual content translations fall back independently without altering Chinese originals', () => {
  const body = {root:{children:[],direction:null,format:'',indent:0,type:'root',version:1}} as Post['body']
  const post = {title:'日志',titleEn:'My journal',excerpt:'中文摘要',excerptEn:'  ',body} as Post
  assert.equal(translatedPost(post,'en').title,'My journal')
  assert.equal(translatedPost(post,'en').excerpt,'中文摘要')
  assert.equal(translatedPost(post,'en').body,body)
  assert.equal(translatedPost(post,'zh-CN').title,'日志')
  assert.equal(translatedPost({...post,bodyEn:structuredClone(body)},'en').body,body)
  assert.equal(post.title,'日志')
  assert.equal(manualTranslation('原文','','en'),'原文')
})

test('admin labels change without changing enum values and standalone card retains its behavior', async () => {
  const { bilingualLabels } = await import('../src/lib/i18n/admin')
  const { localizedCard } = await import('../src/lib/i18n/card')
  const original = {fields:[{name:'state',label:'ui.recordStatus',options:['生活']}]}
  const result = bilingualLabels(original)
  assert.deepEqual(result.fields[0].label,{zh:'航段记录状态',en:'Logbook status'})
  assert.deepEqual(result.fields[0].options,[{label:{zh:'生活随笔',en:'Everyday life'},value:'生活'}])
  assert.equal(original.fields[0].label,'ui.recordStatus')
  const html = localizedCard('en')
  assert.match(html,/<html lang="en">/)
  assert.match(html,/>Collect boarding stamp</)
  assert.match(html,/src="\/card\/client.js"/)
  assert.match(localizedCard('zh-CN'),/>盖下登机纪念章</)
})

test('language changes preserve React keys so forms and interactive components keep state', () => {
  const children = [h('input',{key:'named',defaultValue:'typing'}),h('button',null,'选择机场')]
  const keys = (locale: 'en' | 'zh-CN') => (localizeTree(children,locale) as {key:string}[]).map(node=>node.key)
  assert.deepEqual(keys('en'),keys('zh-CN'))
})

test('catalog keys and placeholders stay aligned, and all coded templates interpolate', () => {
  assert.deepEqual(Object.keys(chinese).sort(),Object.keys(english).sort())
  const slots = (text: string) => [...new Set(text.match(/\{\d+\}/g)||[])].sort()
  for (const key of Object.keys(chinese) as MessageKey[]) {
    assert.match(key,/^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/)
    assert.deepEqual(slots(chinese[key]),slots(english[key]),key)
    const interpolate = (text: string) => text.replace(/\{(\d+)\}/g, (_, index) => String(Number(index)+7))
    const values = Array.from({length:slots(chinese[key]).length},(_,index)=>index+7)
    assert.equal(translate(message(key,...values),'en'),interpolate(english[key]),key)
    assert.equal(translate(message(key,...values),'zh-CN'),interpolate(chinese[key]),key)
  }
  for (const [key, source] of Object.entries(sourceText)) {
    if (/\{\d+\}/.test(source)) {
      const interpolate = (text: string) => text.replace(/\{(\d+)\}/g, (_, index) => String(Number(index)+7))
      assert.equal(translate(interpolate(source),'en'),interpolate(english[key as MessageKey]),key)
    }
  }
  assert.equal(translate('共搭乘 1 家航司','en'),'1 carriers flown in total')
})

test('editing Chinese copy updates UI, attributes and templates without changing English or stored values', () => {
  const saved = {...chinese}
  try {
    chinese['nav.home'] = '出发大厅'
    chinese['airports.choose'] = '挑选出发地'
    chinese['flights.since'] = '记录始于 {0} 年'
    chinese['flightStatus.completed'] = '已经飞过'
    assert.equal(translate('nav.home','zh-CN'),'出发大厅')
    assert.equal(translate('nav.home','en'),'Paddock')
    assert.equal(translate(message('flights.since',2025),'zh-CN'),'记录始于 2025 年')
    assert.equal(translate('从 2025 年到现在','zh-CN'),'记录始于 2025 年')
    assert.equal(translate('实际出发','en'),'Actual Departure')
    const output = renderToStaticMarkup(h(LocaleProvider,{locale:'zh-CN'},h(Localized,null,
      h('section',null,h('button',{'aria-label':message('airports.choose')},message('nav.home')),
      h('select',null,h('option',null,message('flightStatus.completed'))),h('p',{'data-i18n':'off'},'围场')))))
    assert.match(output,/aria-label="挑选出发地"/)
    assert.match(output,/>出发大厅</)
    assert.match(output,/<option value="已完成">已经飞过<\/option>/)
    assert.match(output,/>围场<\/p>/)
  } finally { Object.assign(chinese,saved) }
})

test('standalone card and maintenance pages use edited Chinese copy and escape HTML', async () => {
  const { localizedCard } = await import('../src/lib/i18n/card')
  const { maintenanceHTML } = await import('../src/lib/i18n/maintenance')
  const saved = {...chinese}
  const template = await readFile('scripts/maintenance/in-pit.template.html','utf8')
  try {
    chinese['card.title'] = '新名片 "测试" <Merak>'
    chinese['card.waiting'] = '请稍候登机'
    chinese['maintenance.heading'] = '正在进站 <稍后>'
    const card = localizedCard('zh-CN')
    assert.match(card,/<title>新名片 &quot;测试&quot; &lt;Merak&gt;<\/title>/)
    assert.match(card,/"card.waiting":"请稍候登机"/)
    assert.doesNotMatch(card,/@i18n:/)
    assert.match(localizedCard('en'),/<title>Merak · Digital Boarding Pass<\/title>/)
    const maintenance = maintenanceHTML(template)
    assert.match(maintenance,/>正在进站 &lt;稍后&gt;<\/p>/)
    assert.doesNotMatch(maintenance,/@i18n:/)
    assert.match(maintenanceHTML(template,'en'),/>In the pits. Back on track shortly.<\/p>/)
  } finally { Object.assign(chinese,saved) }
})

test('all literal code references resolve to existing catalog keys', async () => {
  const files: string[] = []
  async function walk(directory: string) {
    for (const entry of await readdir(directory,{withFileTypes:true})) {
      const path = join(directory,entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(tsx?|html)$/.test(path)) files.push(path)
    }
  }
  await walk('src');await walk('scripts/maintenance')
  for (const path of files) {
    if (/i18n\/(?:en|zh|sources)\.ts$/.test(path)) continue
    const text = await readFile(path,'utf8')
    for (const match of text.matchAll(/@i18n:([a-zA-Z][\w.]+)/g)) assert.ok(isMessageKey(match[1]),path+': '+match[1])
    for (const match of text.matchAll(/(?:t|translate|i18nMessage)\(['"]([a-z][\w.]*\.[\w.]+)['"]/g)) assert.ok(isMessageKey(match[1]),path+': '+match[1])
  }
})

test('coded references work inside composed labels and preserve authored interpolation values', () => {
  assert.equal(translate(`2026.10.18 ${message('flightStatus.completed')}`,'en'),'2026.10.18 Completed')
  assert.equal(translate(message('gallery.selectEntry',1,'关于'),'en'),'Select entry #1: 关于')
  assert.equal(translate(message('gallery.selectEntry',1,'nav.home'),'en'),'Select entry #1: nav.home')
  assert.equal(translate(message('gallery.selectEntry',2,message('nav.home')),'zh-CN'),'查看第 2 期：围场')
  assert.equal(translate('@i18n:missing.key@','en'),'@i18n:missing.key@')
  assert.equal(translate('@i18n:nav.home:%broken@','en'),'@i18n:nav.home:%broken@')
})
