import { legacyImageURL } from '@/lib/assets'
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
    { name: 'exposure', label: '拍摄参数', type: 'group', fields: [
      { name: 'medium', label: '拍摄介质', type: 'select', defaultValue: 'digital', options: [{label:'数码',value:'digital'},{label:'胶片',value:'film'}] },
      { name: 'camera', label: '相机', type: 'text', maxLength: 80 },
      { name: 'lens', label: '镜头', type: 'text', maxLength: 100 },
      { name: 'focalLength', label: '焦段（如 85 mm）', type: 'text', maxLength: 24 },
      { name: 'filmStock', label: '胶片型号', type: 'text', maxLength: 80, admin: { condition: (_, siblingData) => siblingData?.medium === 'film' } },
      { name: 'shutter', label: '快门（如 1/250 s）', type: 'text', maxLength: 24 },
      { name: 'aperture', label: '光圈（如 f/2.8）', type: 'text', maxLength: 24 },
      { name: 'iso', label: 'ISO', type: 'number', min: 1, max: 3276800 },
    ] },
    { name: 'source', label: '来源链接', type: 'text' },
    { name: 'visibility', label: '媒体公开范围', type: 'select', required: true, defaultValue: 'private', options: [{ label: '私有', value: 'private' }, { label: '公开', value: 'public' }] },
    { name: 'legacyPath', type: 'text', unique: true, access: { read: ({ req, doc }) => Boolean(req.user) || (doc?.visibility === 'public' && Boolean(legacyImageURL(doc?.legacyPath))) }, admin: { hidden: true } },
  ],
}
