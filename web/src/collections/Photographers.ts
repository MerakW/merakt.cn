import { randomUUID } from 'node:crypto'
import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { adminOnly, editingAccess } from '@/lib/access'
import { creditsOf, personKey } from '@/lib/gallery'

export function profileURL(value: unknown) {
  if (value == null || value === '') return true
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password || '请输入有效的 HTTP 或 HTTPS 主页地址。' }
  catch { return '请输入有效的 HTTP 或 HTTPS 主页地址。' }
}
export const Photographers: CollectionConfig = {
  slug: 'photographers', labels: { singular: { zh: '摄影师', en: 'Photographer' }, plural: { zh: '摄影师', en: 'Photographers' } },
  admin: { useAsTitle: 'name', group: 'ui.content', defaultColumns: ['id', 'name', 'url'] },
  access: { ...editingAccess, read: () => true, delete: adminOnly },
  hooks: { beforeDelete: [async ({ req, id }) => {
    const result = await req.payload.find({ collection: 'albums', req, depth: 0, limit: 1, where: { or: [{ photographers: { contains: id } }, { 'photos.photographers': { contains: id } }] } })
    if (result.totalDocs) throw new Error('这位摄影师仍被相册引用，不能删除。')
  }] },
  fields: [
    { name: 'name', label: { zh: '姓名', en: 'Name' }, type: 'text', required: true },
    { name: 'isSelf', label: { zh: '本人', en: 'Self' }, type: 'checkbox', defaultValue: false },
    { name: 'url', label: { zh: '主页', en: 'Profile URL' }, type: 'text', validate: profileURL },
    { name: 'aliases', label: { zh: '历史署名', en: 'Previous credits' }, type: 'textarea' },
    { name: 'key', type: 'text', unique: true, required: true, admin: { hidden: true }, hooks: { beforeValidate: [async ({ value, originalDoc, siblingData, req }) => {
      if (originalDoc?.key || value) return originalDoc?.key || value
      const nameKey = personKey(siblingData.name || '').toLowerCase()
      const match = await req.payload.find({ collection: 'photographers', req, where: { key: { equals: nameKey } }, limit: 1, depth: 0 })
      return match.totalDocs ? `person:${randomUUID()}` : nameKey
    }] } },
  ],
}

export const photographerLinks: CollectionBeforeValidateHook = async ({ data, originalDoc, req, operation }) => {
  if (!data) return data
  const resolve = async (text: string, explicit?: string | null) => {
    const credit = creditsOf(text, explicit).find(line => line.role === 'photo')
    const names = [...(credit?.names || []), ...(credit?.me ? ['Merak'] : [])]
    const ids: number[] = []
    for (const name of names) {
      const key = personKey(name).toLowerCase()
      const existing = await req.payload.find({ collection: 'photographers', req, depth: 0, limit: 1000, pagination: false })
      let person = existing.docs.find(person => person.key === key) || existing.docs.find(person => (person.aliases || '').split('\n').some(alias => personKey(alias).toLowerCase() === key)) || existing.docs.find(person => personKey(person.name).toLowerCase() === key)
      if (!person) person = await req.payload.create({ collection: 'photographers', req, data: { name: personKey(name), key, aliases: name, isSelf: key === 'merak' } })
      if (!ids.includes(person.id)) ids.push(person.id)
    }
    return ids
  }
  if (data.photographers === undefined && (operation === 'create' || data.photographer !== undefined && data.photographer !== originalDoc.photographer)) {
    data.photographers = await resolve(data.description ?? originalDoc?.description ?? '', data.photographer ?? originalDoc?.photographer)
    const coverID = data.cover ?? originalDoc?.cover
    if (!data.photographers.length && coverID) {
      const image = await req.payload.findByID({ collection: 'media', id: typeof coverID === 'object' ? coverID.id : coverID, req, depth: 0 })
      data.photographers = await resolve('', image.credit)
    }
  }
  if (data.photos) for (const photo of data.photos) {
    const previous = originalDoc?.photos?.find((entry: { id?: string }) => entry.id === photo.id)
    if (photo.photographers === undefined && (!previous || photo.credit !== undefined && photo.credit !== previous.credit)) {
      const imageID = typeof photo.image === 'object' ? photo.image.id : photo.image
      const image = imageID ? await req.payload.findByID({ collection: 'media', id: imageID, req, depth: 0 }) : null
      photo.photographers = await resolve(photo.caption || '', photo.credit || data.photographer || originalDoc?.photographer)
      if (!photo.photographers.length && image?.credit) photo.photographers = await resolve('', image.credit)
    }
  }
  return data
}
