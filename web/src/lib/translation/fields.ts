export type TranslationPatch = { path: string; value: unknown }
type Item = { source: string; apply: (text: string) => void }

function hasRichContent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const node = value as Record<string, unknown>
  return Boolean((typeof node.text === 'string' && node.text.trim()) || ['upload', 'block', 'relationship'].includes(String(node.type)) || hasRichContent(node.root) || (Array.isArray(node.children) && node.children.some(hasRichContent)))
}

export function translationSnapshot(collection: string, data: Record<string, unknown>): string {
  const keys: Record<string, string[]> = { posts: ['title', 'titleEn', 'excerpt', 'excerptEn', 'body', 'bodyEn'], albums: ['title', 'titleEn', 'description', 'descriptionEn'], notes: ['text', 'textEn'], media: ['alt', 'altEn'] }
  const state = Object.fromEntries((keys[collection] || []).map(key => [key, data[key]]))
  const array = collection === 'albums' ? 'photos' : collection === 'notes' ? 'radioMessages' : ''
  const field = collection === 'albums' ? 'caption' : 'message'
  if (array) state[array] = Array.isArray(data[array]) ? data[array].map(row => ({ id: row.id, [field]: row[field], [field + 'En']: row[field + 'En'] })) : data[array]
  return JSON.stringify(state)
}

export function readableTranslation(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  if (typeof node.text === 'string') return node.text
  if (node.root) return readableTranslation(node.root)
  return Array.isArray(node.children) ? node.children.map(readableTranslation).join(node.type === 'root' ? '\n' : '') : ''
}

// Only text leaves enter the provider request; relationships, uploads and Lexical metadata stay local.
export function translationPlan(collection: string, data: Record<string, unknown>, overwrite = false) {
  const items: Item[] = []
  const patches: TranslationPatch[] = []
  const pair = (record: Record<string, unknown>, name: string, path = '', rich = false) => {
    const target = name + 'En'
    if (!overwrite && (rich ? hasRichContent(record[target]) : readableTranslation(record[target]).trim())) return
    if (!rich) {
      if (typeof record[name] !== 'string' || !record[name].trim()) return
      const patch: TranslationPatch = { path: path + target, value: '' }
      patches.push(patch)
      items.push({ source: record[name], apply: text => { patch.value = text } })
      return
    }
    if (!record[name] || typeof record[name] !== 'object') return
    const value = structuredClone(record[name]) as Record<string, unknown>
    const start = items.length
    const visit = (node: Record<string, unknown>) => {
      if (node.type === 'code' || node.type === 'code-highlight') return
      if (node.type === 'text' && !(Number(node.format) & 16) && typeof node.text === 'string' && node.text.trim()) items.push({ source: node.text, apply: text => { node.text = text } })
      if (node.root && typeof node.root === 'object') visit(node.root as Record<string, unknown>)
      if (Array.isArray(node.children)) for (const child of node.children) if (child && typeof child === 'object') visit(child)
    }
    visit(value)
    if (items.length > start) patches.push({ path: path + target, value })
  }
  const rows = (name: string, field: string) => {
    if (Array.isArray(data[name])) data[name].forEach((row, index) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) pair(row, field, `${name}.${index}.`)
    })
  }
  switch (collection) {
    case 'posts': pair(data, 'title'); pair(data, 'excerpt'); pair(data, 'body', '', true); break
    case 'albums': pair(data, 'title'); pair(data, 'description'); rows('photos', 'caption'); break
    case 'notes': pair(data, 'text'); rows('radioMessages', 'message'); break
    case 'media': pair(data, 'alt'); break
    case 'photo-caption': pair(data, 'caption'); break
    default: throw new Error('此内容类型没有可翻译字段。')
  }
  return { items, patches }
}
