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
