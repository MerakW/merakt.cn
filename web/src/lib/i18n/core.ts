import { english } from './en'
import { chinese, type MessageKey } from './zh'
import { sourceText } from './sources'
export type { MessageKey } from './zh'

export type Locale = 'zh-CN' | 'en'
export const localeCookie = 'merak-locale'
export function preferredLocale(cookie?: string, acceptLanguage = ''): Locale {
  if (cookie === 'en' || cookie === 'zh-CN') return cookie
  const languages = acceptLanguage.split(',').map((entry, index) => {
    const [language, quality] = entry.trim().split(';q=')
    return { language, quality: quality === undefined ? 1 : Number(quality), index }
  }).filter(entry => entry.quality > 0).sort((a,b) => b.quality-a.quality || a.index-b.index)
  for (const { language } of languages) {
    if (/^en(?:-|$)/i.test(language)) return 'en'
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN'
  }
  return 'zh-CN'
}
const legacySources: Partial<Record<MessageKey, string>> = sourceText
const sourceKeys = new Map(Object.entries(sourceText).map(([key, source]) => [source, key as MessageKey]))
const templates = Object.entries(sourceText).filter(([, source]) => /\{\d+\}/.test(source))
  .sort(([, a],[, b]) => b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length)
  .map(([key, source]) => ({
    key: key as MessageKey,
    pattern: new RegExp('^' + source.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? '(.*?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$'),
  }))
export function isMessageKey(value: string): value is MessageKey { return Object.hasOwn(chinese, value) }
export type MessageValue = string | number
/** Language-neutral reference for React output, state messages and formatted labels. */
export function message(key: MessageKey, ...values: MessageValue[]): string {
  return '@i18n:' + key + (values.length ? ':' + encodeURIComponent(JSON.stringify(values)) : '') + '@'
}
/** Keep implicit option values and other existing wire values independent of copy edits. */
export function sourceValue(value: string): string {
  const key = value.startsWith('@i18n:') ? value.slice(6).replace(/@$/, '') : value
  return isMessageKey(key) ? legacySources[key] ?? value : value
}
function renderMessage(key: MessageKey, locale: Locale, values?: readonly MessageValue[]): string {
  const text = (locale === 'en' ? english : chinese)[key]
  return values ? text.replace(/\{(\d+)\}/g, (placeholder, index) => {
    const value = values[Number(index)]
    if (value === undefined) return placeholder
    return typeof value === 'string' && value.startsWith('@i18n:') ? translate(value, locale) : String(value)
  }) : text
}
export function translate(text: string, locale: Locale, values?: readonly MessageValue[]): string {
  const input = text.replace(/\s+/g, ' ').trim()
  let translated: string | undefined
  if (isMessageKey(input)) translated = renderMessage(input, locale, values)
  else if (input.includes('@i18n:')) {
    return text.replace(/@i18n:([a-zA-Z][\w.]*)(?::([^@]*))?@/g, (reference, key: string, parameters?: string) => {
      if (!isMessageKey(key)) return reference
      try { return renderMessage(key, locale, parameters ? JSON.parse(decodeURIComponent(parameters)) : values) }
      catch { return reference }
    })
  } else if (/[\p{Script=Han}]/u.test(input)) {
    // Existing API responses and stored display values keep their wire format.
    const key = sourceKeys.get(input)
    if (key) translated = renderMessage(key, locale)
    else for (const template of templates) {
      const match = input.match(template.pattern)
      if (match) { translated = renderMessage(template.key, locale, match.slice(1).map(value => translate(value, locale))); break }
    }
  }
  return translated === undefined ? text : text.slice(0, text.length-text.trimStart().length) + translated + text.slice(text.trimEnd().length)
}
/** Blank manual translations fall back to the original without changing stored content. */
export function manualTranslation<T>(original: T, englishValue: T | null | undefined, locale: Locale): T {
  return locale === 'en' && englishValue != null && (typeof englishValue !== 'string' || englishValue.trim()) ? englishValue : original
}

export function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!)
}
