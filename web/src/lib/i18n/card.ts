import { cardHTML } from '../card-html'
import { cardClientScript } from '../card-client'
import { isMessageKey, translate, escapeHTML, type Locale } from './core'
export function localizedCard(locale: Locale) {
  const keys = new Set([
    ...Array.from(cardHTML.matchAll(/@i18n:([\w.]+)/g), match => match[1]),
    ...Array.from(cardClientScript.matchAll(/cardText\('([\w.]+)'\)/g), match => match[1]),
  ])
  const dictionary = Object.fromEntries([...keys].filter(isMessageKey).map(key => [key, translate(key, locale)]))
  const data = JSON.stringify(dictionary).replace(/</g,'\\u003c')
  let html = cardHTML.replace('/card-assets/card.js', '/card/client.js').replace('<html lang="zh-CN">', `<html lang="${locale}">`)
  html = html.replace(/>([^<>]+)</g, (_, text: string) => '>' + (text.includes('@i18n:') ? escapeHTML(translate(text, locale)) : text) + '<').replace(/(aria-label|content)="([^"]*)"/g, (_, attribute: string, text: string) => `${attribute}="${text.includes('@i18n:') ? escapeHTML(translate(text, locale)) : text}"`)
  html = html.replace('<script src=', `<script>window.MERAK_CARD_I18N=${data}</script><script src=`)
  return html.replace('<span class="toolbar-title">', `<button class="circle-button" type="button" aria-label="${escapeHTML(translate(locale === 'en' ? 'language.switchToChinese' : 'language.switchToEnglish', locale))}" onclick="document.cookie='merak-locale=${locale === 'en' ? 'zh-CN' : 'en'}; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');location.reload()">${escapeHTML(translate(locale === 'en' ? 'language.chinese' : 'language.english', locale))}</button><span class="toolbar-title">`)
}
