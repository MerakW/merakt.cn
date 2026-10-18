import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { maintenanceHTML } from '../src/lib/i18n/maintenance'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '../src/proxy'

test('maintenance replaces page data safely and keeps the uploaded recovery behavior', async () => {
 const template = await readFile('scripts/maintenance/in-pit.template.html','utf8')
 const html = maintenanceHTML(template,'en',{startedAt:'2026-10-18T09:00:00+08:00',expectedExit:'2026-10-19T09:30:00+08:00'})
 assert.match(html, /startedAt: "2026-10-18T01:00:00.000Z"/)
 assert.match(html, /expectedExit: "2026-10-19T01:30:00.000Z"/)
 assert.match(html, /<html lang="en" data-merak-maintenance/)
 assert.match(html, /T\("maintenance.auto", \{ 0:/)
 assert.match(html, /body.includes\("data-merak-maintenance"\)/)
 assert.match(html, /preview: false/)
 assert.match(maintenanceHTML(template,'en',{preview:true}), /preview: true/)
 assert.match(html, /if \(CONFIG.preview && params.get\("preview"\) !== "back"\) return "out"/)
 assert.match(html, /font-family:"Formula1 Recovery"/)
 assert.equal((html.match(/var MERAK_MESSAGES =/g)||[]).length,1)
 assert.match(maintenanceHTML(html,'zh-CN',{expectedExit:'</script>'}), /expectedExit: null/)
})

test('maintenance covers public pages and preserves management and recovery access', () => {
 for (const url of ['/','/blog','/blog/hello','/flights','/card']) assert.equal(unstable_doesMiddlewareMatch({config,url}),true,url)
 for (const url of ['/admin','/admin/globals/site-settings','/api/users/login','/api/site-availability','/pit-wall','/manage/security','/_next/static/app.js','/maintenance-preview','/status-preview','/red-flag-preview','/fonts/file.woff2']) assert.equal(unstable_doesMiddlewareMatch({config,url}),false,url)
})


test('recovery pages share an embedded SVG favicon and text fonts include a CJK fallback', async () => {
 const template = await readFile('scripts/maintenance/in-pit.template.html','utf8')
 const globalError = await readFile('src/app/global-error.tsx','utf8')
 const icon = template.match(/<link rel="icon"[^>]*href="([^"]+)"/)?.[1]
 assert.ok(icon)
 assert.ok(icon.startsWith('data:image/svg+xml,'))
 assert.match(decodeURIComponent(icon.slice('data:image/svg+xml,'.length)), /<svg\b/)
 assert.equal(JSON.parse(globalError.match(/const FAVICON_URL = ("[^"]+");/)![1]),icon)
 for (const page of [template,globalError]) {
  assert.match(page, /font-family:"Pit Text"/)
  assert.match(page, /unicode-range:U\+0000-024F,U\+2000-206F/)
  assert.match(page, /Microsoft YaHei/)
 }
})

test('manual maintenance uses scheduled-stop copy and keeps administrator recovery access', async () => {
 const template = await readFile('scripts/maintenance/in-pit.template.html','utf8')
 const html = maintenanceHTML(template,'zh-CN',{manual:true})
 assert.match(html, /manual: true/)
 assert.match(html, /id="code" data-i18n="maintenance.manualCode">BOX BOX · 计划维护/)
 assert.match(html, /id="admin-entry" href="\/manage\/maintenance"/)
 assert.match(html, /--text:"Formula1 Text"/)
})
