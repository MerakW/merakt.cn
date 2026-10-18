import { translate, escapeHTML, type Locale } from './core'
import { chinese } from './zh'

/** Shared by the live 503 response and nginx's independent fallback. */
export function maintenanceHTML(template: string, locale: Locale = 'zh-CN', timing: { startedAt?: string | null; expectedExit?: string | null; preview?: boolean; manual?: boolean } = {}) {
  const keys = Object.keys(chinese).filter(key => key.startsWith('maintenance.') || ['common.reconnect','common.checking','common.back'].includes(key))
  const messages = Object.fromEntries(['zh-CN','en'].map(language => [language, Object.fromEntries(keys.map(key => [key, translate(key, language as Locale)]))]))
  const data = JSON.stringify(messages).replace(/</g, '\\u003c')
  const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
  const source = timing.manual ? template.replace('data-i18n="maintenance.code"', 'data-i18n="maintenance.manualCode"').replace('data-i18n="maintenance.description"', 'data-i18n="maintenance.manualDescription"') : template
  return source
    .replace(/manual:\s*(?:true|false)/, `manual: ${timing.manual === true}`)
    .replace(/<html lang="[^"]+"/, `<html lang="${locale}"`)
    .replace(/<script data-maintenance-i18n>[\s\S]*?<\/script>/, `<script data-maintenance-i18n>var MERAK_MESSAGES = ${data};</script>`)
    .replace(/(<([\w]+)[^>]*data-i18n="([\w.]+)"[^>]*>)[^<]*(<\/\2>)/g, (_, open: string, _tag: string, key: string, close: string) => open + escapeHTML(translate(key, locale)) + close)
    .replace(/preview:\s*(?:true|false)/, `preview: ${timing.preview === true}`)
    .replace(/startedAt:\s*(?:null|"[^"]*")/, `startedAt: ${JSON.stringify(date(timing.startedAt))}`)
    .replace(/expectedExit:\s*(?:null|"[^"]*")/, `expectedExit: ${JSON.stringify(date(timing.expectedExit))}`)
    .replace('T("maintenance.auto", { s:', 'T("maintenance.auto", { 0:')
}
