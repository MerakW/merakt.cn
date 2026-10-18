import { legacyImageURL } from '@/lib/assets'
import { resolve } from 'node:path'
import type { CollectionConfig } from 'payload'
import { adminOnly, editingAccess } from '@/lib/access'

export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: "ui.media", plural: "ui.mediaLibrary" },
  admin: { group: "ui.content", useAsTitle: 'alt' },
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
    { name: 'alt', label: "ui.imageDescription", type: 'text', required: true },
    { name: 'altEn', label: 'admin.translation.imageDescription', type: 'text' },
    { name: 'credit', label: "ui.photoCredit", type: 'text' },
    { name: 'exposure', label: "ui.cameraSettings", type: 'group', fields: [
      { name: 'medium', label: "ui.medium", type: 'select', defaultValue: 'digital', options: [{label:"ui.digital",value:'digital'},{label:"ui.film",value:'film'}] },
      { name: 'camera', label: "ui.camera", type: 'text', maxLength: 80 },
      { name: 'lens', label: "ui.lens", type: 'text', maxLength: 100 },
      { name: 'focalLength', label: "ui.focalLengthEG85Mm", type: 'text', maxLength: 24 },
      { name: 'filmStock', label: "ui.filmStock", type: 'text', maxLength: 80, admin: { condition: (_, siblingData) => siblingData?.medium === 'film' } },
      { name: 'shutter', label: "ui.shutterSpeedEG1250S", type: 'text', maxLength: 24 },
      { name: 'aperture', label: "ui.apertureEGF28", type: 'text', maxLength: 24 },
      { name: 'iso', label: 'ISO', type: 'number', min: 1, max: 3276800 },
    ] },
    { name: 'source', label: "ui.sourceLink", type: 'text' },
    { name: 'visibility', label: "ui.mediaVisibility", type: 'select', required: true, defaultValue: 'private', options: [{ label: "ui.private2", value: 'private' }, { label: "ui.public", value: 'public' }] },
    { name: 'legacyPath', type: 'text', unique: true, access: { read: ({ req, doc }) => Boolean(req.user) || (doc?.visibility === 'public' && Boolean(legacyImageURL(doc?.legacyPath))) }, admin: { hidden: true } },
  ],
}
