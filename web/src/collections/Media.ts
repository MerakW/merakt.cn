import { resolve } from 'node:path'
import type { CollectionConfig } from 'payload'
import { adminOnly, editingAccess } from '@/lib/access'

export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: '媒体', plural: '媒体库' },
  admin: { group: '内容', useAsTitle: 'alt' },
  access: { ...editingAccess, read: ({ req }) => req.user ? true : { visibility: { equals: 'public' } } },
  upload: {
    staticDir: resolve(/* turbopackIgnore: true */ process.env.MEDIA_DIR || './.data/media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'],
    imageSizes: [
      { name: 'thumbnail', width: 480, withoutEnlargement: true },
      { name: 'display', width: 1440, withoutEnlargement: true },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  fields: [
    { name: 'alt', label: '图片说明', type: 'text', required: true },
    { name: 'credit', label: '摄影署名', type: 'text' },
    { name: 'source', label: '来源链接', type: 'text' },
    { name: 'visibility', label: '媒体公开范围', type: 'select', required: true, defaultValue: 'private', options: [{ label: '私有', value: 'private' }, { label: '公开', value: 'public' }] },
    { name: 'legacyPath', type: 'text', unique: true, access: { read: ({ req }) => Boolean(req.user) }, admin: { hidden: true } },
  ],
}
