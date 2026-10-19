import { manualTranslation, type Locale } from './i18n/core'
import { imageURL, legacyImageURL } from './assets'
import type { Album, Media } from '@/payload-types'

export interface GalleryPhoto {
  id: number; src: string; display: string; thumbnail: string; srcSet?: string; width: number; height: number;
  exposure?: Media['exposure']; alt: string; caption: string; credit?: string; source?: string; video: boolean;
}
export interface GalleryAlbum { id: number; slug: string; title: string; date: string; description: string; compound?: string | null; photos: GalleryPhoto[] }
export function safeLink(value?: string | null) { return value && /^https?:\/\//i.test(value) ? value : undefined }
const mediaPath = (filename: string) => imageURL(`/api/media/file/${encodeURIComponent(filename)}`)

export function publicPhoto(value: number | Media | null | undefined, caption?: string | null, credit?: string | null, source?: string | null): GalleryPhoto | null {
  if (!value || typeof value !== 'object' || value.visibility !== 'public' || !value.filename) return null
  const display = value.sizes?.display, thumbnail = value.sizes?.thumbnail
  const legacy = process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1' ? undefined : legacyImageURL(value.legacyPath)
  const src = legacy || mediaPath(value.filename)
  return {
    id: value.id, exposure: value.exposure, src, display: legacy || (display?.filename ? mediaPath(display.filename) : src),
    thumbnail: legacy || (thumbnail?.filename ? mediaPath(thumbnail.filename) : src),
    srcSet: legacy ? undefined : [thumbnail, display].filter(size => size?.filename && size.width).map(size => `${mediaPath(size!.filename!)} ${size!.width}w`).join(', ') || undefined,
    width: value.width || 1600, height: value.height || 1000, alt: value.alt,
    caption: caption || '', credit: credit || value.credit || undefined, source: safeLink(source || value.source), video: value.mimeType?.startsWith('video/') || false,
  }
}

export function publicAlbum(album: Album, locale: Locale = 'zh-CN'): GalleryAlbum | null {
  if (album._status !== 'published') return null
  const photos = (album.photos || []).flatMap(photo => {
    const image = publicPhoto(photo.image, manualTranslation(photo.caption, photo.captionEn, locale), photo.credit || album.photographer, photo.source)
    return image ? [{ ...image, alt: typeof photo.image === 'object' && photo.image ? manualTranslation(image.alt, photo.image.altEn, locale) : image.alt }] : []
  })
  if (!photos.length) { const cover = publicPhoto(album.cover, manualTranslation(album.description, album.descriptionEn, locale), album.photographer); if (cover) photos.push({ ...cover, alt: typeof album.cover === 'object' && album.cover ? manualTranslation(cover.alt, album.cover.altEn, locale) : cover.alt }) }
  return photos.length ? { id: album.id, slug: album.slug, title: manualTranslation(album.title, album.titleEn, locale), date: album.date?.slice(0, 10) || '', description: manualTranslation(album.description, album.descriptionEn, locale) || '', compound: album.compound, photos } : null
}

export type CreditRole = 'suiter' | 'photo' | 'light' | 'edit' | 'maker'
/** One credit line of a post. `names` keeps the handles as written; `me` means Merak's owner is (also) on this line. */
export interface Credit { role: CreditRole; names: string[]; me: boolean }
const ROLE_OF: Record<string, CreditRole> = { '📷': 'photo', '🥩': 'suiter', '🔦': 'light', '🪄': 'edit', '🪡': 'maker' }
const ROLE_ORDER: CreditRole[] = ['suiter', 'photo', 'light', 'edit', 'maker']
const ROLE_MARK = /📷|🥩|🔦|🪄|🪡/gu
const ROLE_LINE = /^((?:(?:📷|🥩|🔦|🪄|🪡)\uFE0F?\s*[&＆+/、]?\s*)+)[:：]?\s*(.*)$/u
const TEXT_ROLE: Record<string, CreditRole> = { '摄影':'photo', '摄影师':'photo', photo:'photo', photography:'photo', '毛替':'suiter', '出镜':'suiter', 'in the suit':'suiter', featuring:'suiter', '后期':'edit', '後期':'edit', edit:'edit', '灯光':'light', '打光':'light', lighting:'light', '毛装':'maker', '工房':'maker', '制作':'maker', maker:'maker', 'suit maker':'maker' }
const TEXT_ROLE_LINE = /^(摄影师?|Photo(?:graphy)?|毛替|出镜|In the suit|Featuring|后期|後期|Edit|灯光|打光|Lighting|毛装|工房|制作|Maker|Suit Maker)\s*[:：]\s*(.*)$/iu
const SELF = /^(我|我自己|自己|本人|me|myself|merak|米拉克)$/i
const CREDIT_ALIASES: Record<string, string> = {
  furryporridge: '熙帆', '稀饭': '熙帆',
  xwhuan14708: '妄欢',
  '完蛋了我忘了(╥_╥)': 'Mr_Qingning', mr_qingning: 'Mr_Qingning',
}
/** A confirmed display name, shared by credit deduplication and the end credits. */
export function personKey(name: string) {
  const clean = name.trim().replace(/^[@＠]/, '').replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]+$/u, '').trim()
  return CREDIT_ALIASES[clean.toLowerCase()] || clean
}
const creditLines = (text: string) => text.replaceAll('&amp;', '&').replace(/[^\S\n]*(?<=\s)(?=📷|🥩|🔦|🪄|🪡)/gu, '\n').split('\n')
const namesIn = (value: string) => value.split(/[\s,，、]+/).filter(name => name && !name.startsWith('#') && personKey(name))

/**
 * Reads the emoji credit lines a post is written with: 📷 photographer, 🥩 whoever wore Merak, 🔦 lighting, 🪄 editing, 🪡 suit maker.
 * Lines like「🐲神の🥩」credit someone else's character and are skipped. The CMS photographer field wins over 📷 when set.
 */
export function creditsOf(text = '', credit?: string | null): Credit[] {
  const found = new Map<CreditRole, string[]>()
  const add = (role: CreditRole, names: string[]) => {
    const list = found.get(role) || []
    for (const name of names) if (!list.some(known => personKey(known) === personKey(name))) list.push(name)
    found.set(role, list)
  }
  for (const line of creditLines(text)) {
    const match = line.trim().match(ROLE_LINE)
    if (match) for (const mark of match[1].match(ROLE_MARK)!) add(ROLE_OF[mark], namesIn(match[2]))
    else { const words = line.trim().match(TEXT_ROLE_LINE); if (words) add(TEXT_ROLE[words[1].toLowerCase()], namesIn(words[2])) }
  }
  if (credit?.trim()) found.set('photo', namesIn(credit))
  return ROLE_ORDER.flatMap(role => {
    const names = found.get(role) || [], others = names.filter(name => !SELF.test(personKey(name)))
    return names.length ? [{ role, names: others, me: others.length < names.length }] : []
  })
}

/** The post text without its credit lines, which the page shows on their own. */
export const withoutCredits = (text = '') => creditLines(text).filter(line => !ROLE_LINE.test(line.trim()) && !TEXT_ROLE_LINE.test(line.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim()

/** Combine only explicitly recorded self credits; missing credits stay unknown. */
export function creditParts(lines: Credit[]): (Credit & { roles: CreditRole[]; selfPortrait?: boolean })[] {
  const self = (role: CreditRole) => lines.some(line => line.role === role && line.me && !line.names.length)
  const combine = self('photo') && self('edit')
  return lines.flatMap(line => {
    if (line.role === 'suiter' && self('suiter') || line.role === 'edit' && combine) return []
    return [{ ...line, roles: line.role === 'photo' && combine ? ['photo', 'edit'] as CreditRole[] : [line.role], selfPortrait: line.role === 'photo' && self('photo') && self('suiter') }]
  })
}
