import type { CollectionConfig, FieldHook } from 'payload'
import { adminField, adminOnly } from '@/lib/access'
import { HEX_PATTERN, RESERVED_TLAS, TLA_PATTERN, safeHttpURL } from '@/lib/pit-lane'
import { friendClearance, submitFriendApplication } from '@/lib/pit-lane-submit'
import { parseCard } from '@/lib/pit-lane-card'
import { translate, type MessageKey } from '@/lib/i18n/core'

const upperTLA: FieldHook = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value
const readOnly = { readOnly: true }
type Options = { req?: { i18n?: { language?: string } } }
/** Validation messages follow the admin language. */
const fail = (key: MessageKey, options?: Options) => translate(key, options?.req?.i18n?.language === 'en' ? 'en' : 'zh-CN')

export const Friends: CollectionConfig = {
  slug: 'friends', labels: { singular: 'pitLane.admin.friend', plural: 'pitLane.admin.friends' },
  admin: { group: 'ui.content', useAsTitle: 'name', defaultColumns: ['tla', 'name', 'status', 'bay', 'url', 'updatedAt'], description: 'pitLane.admin.description' },
  access: { create: adminOnly, update: adminOnly, delete: adminOnly, read: ({ req }) => req.user ? true : { status: { equals: 'approved' } } },
  endpoints: [{ path: '/apply', method: 'post', handler: submitFriendApplication }, { path: '/clearance', method: 'get', handler: friendClearance }],
  hooks: { beforeValidate: [({ data, operation }) => {
    // Paste a clearance card (email, QQ, X, GitHub issue or YAML) to pre-fill an application.
    if (!data || typeof data.importCard !== 'string' || !data.importCard.trim()) return data
    const card = parseCard(data.importCard), filled: Record<string, unknown> = { ...data }
    for (const key of ['tla', 'name', 'url', 'teamColor', 'bio', 'coolingMsg', 'contact', 'backlinkUrl'] as const) if (card[key] && !filled[key]) filled[key] = card[key]
    if (card.tyre && card.tyre !== 'auto' && !data.tyre) { filled.tyreMode = 'manual'; filled.tyre = card.tyre }
    if (operation === 'create' && (!data.source || data.source === 'admin')) filled.source = /github|```|^#/im.test(data.importCard) ? 'github' : /@|mailto|subject/i.test(data.importCard) ? 'email' : 'social'
    filled.importCard = undefined
    return filled
  }] },
  defaultSort: 'bay',
  fields: [
    { name: 'importCard', label: 'pitLane.admin.importCard', type: 'textarea', virtual: true, admin: { description: 'pitLane.admin.importCardHelp', condition: data => !data?.id, rows: 6 } },
    { type: 'row', fields: [
      { name: 'tla', label: 'pitLane.admin.tla', type: 'text', required: true, unique: true, index: true, minLength: 3, maxLength: 3, hooks: { beforeValidate: [upperTLA] },
        validate: (value: unknown, options: Options) => typeof value === 'string' && TLA_PATTERN.test(value.trim().toUpperCase()) && !RESERVED_TLAS.has(value.trim().toUpperCase()) ? true : fail('pitLane.error.tla', options) },
      { name: 'name', label: 'pitLane.admin.name', type: 'text', required: true, maxLength: 40 },
    ] },
    { name: 'url', label: 'pitLane.admin.url', type: 'text', required: true, validate: (value: unknown, options: Options) => typeof value === 'string' && safeHttpURL(value)?.startsWith('https://') ? true : fail('pitLane.error.url', options) },
    { type: 'row', fields: [
      { name: 'teamColor', label: 'pitLane.admin.teamColor', type: 'text', required: true, defaultValue: '#2349ed', validate: (value: unknown, options: Options) => typeof value === 'string' && HEX_PATTERN.test(value) ? true : fail('pitLane.error.color', options) },
      { name: 'bay', label: 'pitLane.admin.bay', type: 'number', min: 1, max: 99, admin: { description: 'pitLane.admin.bayHelp' } },
    ] },
    { name: 'bio', label: 'pitLane.admin.bio', type: 'text', maxLength: 40 },
    { name: 'coolingMsg', label: 'pitLane.admin.coolingMsg', type: 'text', maxLength: 24, admin: { description: 'pitLane.admin.coolingMsgHelp' } },
    { name: 'logoSource', label: 'pitLane.admin.logoSource', type: 'select', required: true, defaultValue: 'auto', options: [
      { label: 'pitLane.admin.logoAuto', value: 'auto' }, { label: 'pitLane.admin.logoUpload', value: 'upload' }, { label: 'pitLane.admin.logoMonogram', value: 'monogram' },
    ] },
    { name: 'avatar', label: 'pitLane.admin.avatar', type: 'upload', relationTo: 'media', admin: { description: 'pitLane.admin.avatarHelp', condition: (_, sibling) => sibling?.logoSource === 'upload' } },
    { name: 'logo', label: 'pitLane.admin.logo', type: 'upload', relationTo: 'media', admin: { description: 'pitLane.admin.logoHelp', condition: (_, sibling) => sibling?.logoSource === 'auto' } },
    { type: 'row', fields: [
      { name: 'tyreMode', label: 'pitLane.admin.tyreMode', type: 'select', required: true, defaultValue: 'auto', options: [{ label: 'pitLane.admin.tyreAuto', value: 'auto' }, { label: 'pitLane.admin.tyreManual', value: 'manual' }] },
      { name: 'tyre', label: 'pitLane.admin.tyre', type: 'select', options: [{ label: 'SOFT', value: 'S' }, { label: 'MEDIUM', value: 'M' }, { label: 'HARD', value: 'H' }, { label: 'INTERMEDIATE', value: 'I' }, { label: 'WET', value: 'W' }], admin: { condition: (_, sibling) => sibling?.tyreMode === 'manual' } },
    ] },
    { type: 'row', fields: [
      { name: 'bearing', label: 'pitLane.admin.bearing', type: 'number', min: 0, max: 359, admin: { description: 'pitLane.admin.virtualHelp' } },
      { name: 'distance', label: 'pitLane.admin.distance', type: 'number', min: 0, max: 20000 },
    ] },
    { name: 'backlinkUrl', label: 'pitLane.admin.backlinkUrl', type: 'text', admin: { description: 'pitLane.admin.backlinkUrlHelp' }, validate: (value: unknown, options: Options) => !value || (typeof value === 'string' && safeHttpURL(value)) ? true : fail('pitLane.error.url', options) },
    { name: 'contact', label: 'pitLane.admin.contact', type: 'text', maxLength: 80, access: { read: adminField }, admin: { description: 'pitLane.admin.contactHelp' } },
    { name: 'status', label: 'ui.reviewStatus', type: 'select', required: true, defaultValue: 'pending', index: true, options: [
      { label: 'ui.pendingReview', value: 'pending' }, { label: 'ui.approved2', value: 'approved' }, { label: 'ui.hidden', value: 'rejected' },
    ], admin: { position: 'sidebar' } },
    { name: 'source', label: 'pitLane.admin.source', type: 'select', defaultValue: 'admin', options: [
      { label: 'pitLane.admin.sourceWeb', value: 'web' }, { label: 'pitLane.admin.sourceEmail', value: 'email' }, { label: 'pitLane.admin.sourceSocial', value: 'social' }, { label: 'GitHub', value: 'github' }, { label: 'pitLane.admin.sourceAdmin', value: 'admin' },
    ], admin: { position: 'sidebar' } },
    { name: 'backlinkAt', label: 'pitLane.admin.backlinkAt', type: 'date', admin: { position: 'sidebar', readOnly: true, description: 'pitLane.admin.backlinkAtHelp', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'ticketHash', type: 'text', index: true, access: { read: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'maintenance', label: 'pitLane.admin.maintenance', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'pitLane.admin.maintenanceHelp' } },
    { name: 'joinedAt', label: 'pitLane.admin.joinedAt', type: 'date', admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } } },
    { name: 'health', label: 'pitLane.admin.health', type: 'group', admin: { position: 'sidebar' }, fields: [
      { name: 'state', label: 'pitLane.admin.healthState', type: 'select', defaultValue: 'green', options: [{ label: 'GREEN', value: 'green' }, { label: 'INTER', value: 'inter' }, { label: 'WET', value: 'wet' }, { label: 'RED FLAG', value: 'red' }], admin: readOnly },
      { name: 'failStreak', type: 'number', defaultValue: 0, admin: { ...readOnly, hidden: true } },
      { name: 'okStreak', type: 'number', defaultValue: 0, admin: { ...readOnly, hidden: true } },
      { name: 'history', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'latencyMs', label: 'pitLane.admin.latency', type: 'number', admin: readOnly },
      { name: 'checkedAt', label: 'pitLane.admin.checkedAt', type: 'date', admin: { ...readOnly, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'backlinkCheckedAt', type: 'date', admin: { hidden: true } },
    // Legacy RSS columns: no longer read or written (friends' updates are not tracked); kept so existing data is not dropped.
    { name: 'feedUrl', type: 'text', access: { read: adminField }, admin: { hidden: true } },
    { name: 'lastPostAt', type: 'date', access: { read: adminField }, admin: { hidden: true } },
    { name: 'feedCheckedAt', type: 'date', access: { read: adminField }, admin: { hidden: true } },
    { name: 'logoCheckedAt', type: 'date', admin: { hidden: true } },
  ],
}
