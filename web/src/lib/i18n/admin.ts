import { translate, isMessageKey } from './core'
/** Localize schema labels while preserving field names, stored values and access rules. */
export function bilingualLabels<T>(config: T): T {
  const labels = new Set(['label','singular','plural','group','description'])
  function visit(value: unknown, key = ''): unknown {
    if (typeof value === 'string' && labels.has(key) && (isMessageKey(value) || /[\p{Script=Han}]/u.test(value))) return { zh: translate(value, 'zh-CN'), en: translate(value, 'en') }
    if (Array.isArray(value)) return value.map(item => key === 'options' && typeof item === 'string' ? { label: { zh: translate(item, 'zh-CN'), en: translate(item, 'en') }, value: item } : visit(item))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name)]))
    return value
  }
  return visit(config) as T
}
