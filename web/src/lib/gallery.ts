import { imageURL } from './assets'
import type { Album, Media } from '@/payload-types'

export interface GalleryPhoto {
  id: number; src: string; display: string; thumbnail: string; srcSet?: string; width: number; height: number;
  alt: string; caption: string; credit?: string; source?: string; video: boolean;
}
export interface GalleryAlbum { id: number; slug: string; title: string; date: string; description: string; photos: GalleryPhoto[] }
export function safeLink(value?: string | null) { return value && /^https?:\/\//i.test(value) ? value : undefined }
const mediaPath = (filename: string) => imageURL(`/api/media/file/${encodeURIComponent(filename)}`)

export function publicPhoto(value: number | Media | null | undefined, caption?: string | null, credit?: string | null, source?: string | null): GalleryPhoto | null {
  if (!value || typeof value !== 'object' || value.visibility !== 'public' || !value.filename) return null
  const display = value.sizes?.display, thumbnail = value.sizes?.thumbnail
  const src = mediaPath(value.filename)
  return {
    id: value.id, src, display: display?.filename ? mediaPath(display.filename) : src,
    thumbnail: thumbnail?.filename ? mediaPath(thumbnail.filename) : src,
    srcSet: [thumbnail, display].filter(size => size?.filename && size.width).map(size => `${mediaPath(size!.filename!)} ${size!.width}w`).join(', ') || undefined,
    width: value.width || 1600, height: value.height || 1000, alt: value.alt,
    caption: caption || '', credit: credit || value.credit || undefined, source: safeLink(source || value.source), video: value.mimeType?.startsWith('video/') || false,
  }
}

export function publicAlbum(album: Album): GalleryAlbum | null {
  if (album._status !== 'published') return null
  const photos = (album.photos || []).flatMap(photo => {
    const image = publicPhoto(photo.image, photo.caption, photo.credit || album.photographer, photo.source)
    return image ? [image] : []
  })
  if (!photos.length) { const cover = publicPhoto(album.cover, album.description, album.photographer); if (cover) photos.push(cover) }
  return photos.length ? { id: album.id, slug: album.slug, title: album.title, date: album.date?.slice(0, 10) || '', description: album.description || '', photos } : null
}
