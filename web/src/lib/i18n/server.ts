import { cookies, headers } from 'next/headers'
import { localeCookie, preferredLocale, translate, type MessageValue } from './core'
export async function getLocale() {
  const [jar, request] = await Promise.all([cookies(), headers()])
  return preferredLocale(jar.get(localeCookie)?.value, request.get('accept-language') || '')
}
export async function getTranslator() {
  const locale = await getLocale()
  return (text: string, values?: readonly MessageValue[]) => translate(text, locale, values)
}

export async function translatedMetadata<T>(metadata: T): Promise<T> {
  const t = await getTranslator()
  function visit(value: unknown): unknown {
    if (typeof value === 'string') return t(value)
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]))
    return value
  }
  return visit(metadata) as T
}
