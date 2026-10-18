import type { Post, Note } from '@/payload-types'
import { manualTranslation, type Locale } from './core'
function hasRichText(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const node = value as { text?: string; type?: string; root?: unknown; children?: unknown[] }
  return Boolean(node.text?.trim() || node.type === 'upload' || node.type === 'block' || (node.root && hasRichText(node.root)) || node.children?.some(hasRichText))
}
export function translatedPost(post: Post, locale: Locale): Post {
  return { ...post, title: manualTranslation(post.title, post.titleEn, locale), excerpt: manualTranslation(post.excerpt, post.excerptEn, locale), body: manualTranslation(post.body, hasRichText(post.bodyEn) ? post.bodyEn : undefined, locale) }
}
export function translatedNote(note: Note | undefined, locale: Locale): Note | undefined {
  return note && { ...note, text: manualTranslation(note.text, note.textEn, locale), radioMessages: note.radioMessages?.map(message => ({ ...message, message: manualTranslation(message.message, message.messageEn, locale) })) }
}
