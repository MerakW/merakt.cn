import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RadarReadout } from '../src/components/ArrivalRadar'
import { LocaleProvider } from '../src/components/Localized'
import { radarRoute } from '../src/lib/radar'

test('Hangzhou nearby readout hides distance and flight time in both languages', () => {
  const data = radarRoute({lat:30.26,lon:120.16})!
  for (const locale of ['zh-CN','en'] as const) {
    const html = renderToStaticMarkup(h(LocaleProvider,{locale},h(RadarReadout,{data})))
    assert.match(html,locale === 'en' ? /Already near Hangzhou/ : /已在杭州附近/)
    assert.doesNotMatch(html,/KM|A350|Rendezvous|预计|@i18n:/)
  }
})

test('remote city readout identifies suggestions and alternatives without implying a real departure', () => {
  const data = radarRoute({lat:39.9042,lon:116.4074,city:'Beijing'})!
  const html = renderToStaticMarkup(h(LocaleProvider,{locale:'en'},h(RadarReadout,{data})))
  assert.match(html,/KM/)
  assert.match(html,/Suggested departure airport: PEK/)
  assert.match(html,/PEK \/ PKX/)
  assert.doesNotMatch(html,/@i18n:/)
  const manual = renderToStaticMarkup(h(LocaleProvider,{locale:'en'},h(RadarReadout,{data:radarRoute({code:'PKX'})!})))
  assert.doesNotMatch(manual,/Suggested departure airport/)
})
