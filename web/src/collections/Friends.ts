import type { CollectionConfig, FieldHook } from 'payload'
import { adminField, adminOnly } from '@/lib/access'
import { HEX_PATTERN, RESERVED_TLAS, TLA_PATTERN, safeHttpURL } from '@/lib/pit-lane'
import { friendClearance, submitFriendApplication } from '@/lib/pit-lane-submit'
import { garageForgot, garageLogin, garageLogout, garagePassword, garageReset, garageSession, garageUpdate, normalEmail, sendGarageMail, sendNoticeMail, type GarageFriend, type GarageMail } from '@/lib/pit-garage'
import { parseCard } from '@/lib/pit-lane-card'
import { translate, type MessageKey } from '@/lib/i18n/core'

const upperTLA: FieldHook = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value
const readOnly = { readOnly: true }
type Options = { req?: { i18n?: { language?: string } } }
/** Validation messages follow the admin language. */
const fail = (key: MessageKey, options?: Options) => translate(key, options?.req?.i18n?.language === 'en' ? 'en' : 'zh-CN')

export const Friends: CollectionConfig = {
  slug: 'friends', labels: { singular: 'pitLane.admin.friend', plural: 'pitLane.admin.friends' },
  admin: { group: 'ui.content', useAsTitle: 'name', defaultColumns: ['tla', 'name', 'status', 'backlinkAt', 'url', 'updatedAt'], description: 'pitLane.admin.description' },
  access: { create: adminOnly, update: adminOnly, delete: adminOnly, read: ({ req }) => req.user ? true : { status: { equals: 'approved' } } },
  endpoints: [{ path: '/apply', method: 'post', handler: submitFriendApplication }, { path: '/clearance', method: 'get', handler: friendClearance },
    { path: '/garage/session', method: 'get', handler: garageSession }, { path: '/garage/login', method: 'post', handler: garageLogin }, { path: '/garage/logout', method: 'post', handler: garageLogout },
    { path: '/garage/update', method: 'post', handler: garageUpdate }, { path: '/garage/password', method: 'post', handler: garagePassword }, { path: '/garage/forgot', method: 'post', handler: garageForgot }, { path: '/garage/reset', method: 'post', handler: garageReset }],
  hooks: { beforeValidate: [({ data, operation }) => {
    // Paste a clearance card (email, GitHub issue, YAML, or an older DM card) to pre-fill an application.
    if (!data || typeof data.importCard !== 'string' || !data.importCard.trim()) return data
    const card = parseCard(data.importCard), filled: Record<string, unknown> = { ...data }
    for (const key of ['tla', 'name', 'url', 'teamColor', 'bio', 'coolingMsg', 'contact', 'backlinkUrl'] as const) if (card[key] && !filled[key]) filled[key] = card[key]
    if (card.tyre && card.tyre !== 'auto' && !data.tyre) { filled.tyreMode = 'manual'; filled.tyre = card.tyre }
    if (operation === 'create' && (!data.source || data.source === 'admin')) filled.source = /github|```|^#/im.test(data.importCard) ? 'github' : /@|mailto|subject/i.test(data.importCard) ? 'email' : 'social'
    filled.importCard = undefined
    return filled
  }],
  // Garage accounts: approving a card opens its login and mails the team; Merak can also open one by hand.
  beforeChange: [({ data, originalDoc, req, context }) => {
    if (context.garage || !data) return data
    // Review result for applicants who asked for email updates: only the first decision on a pending card.
    const previous = (originalDoc || {}) as { status?: string; notify?: boolean | null; contact?: string | null }, decided = data.status ?? previous.status
    if (previous.status === 'pending' && (decided === 'approved' || decided === 'rejected') && (data.notify ?? previous.notify) && normalEmail(data.contact ?? previous.contact)) req.context.pitNotice = decided === 'approved' ? 'live' : 'rejected'
    if (typeof data.accountEmail === 'string') data.accountEmail = normalEmail(data.accountEmail) || data.accountEmail.trim().toLowerCase() || null
    const before = (originalDoc || {}) as Partial<GarageFriend>, email = 'accountEmail' in data ? data.accountEmail : before.accountEmail
    const emailChanged = 'accountEmail' in data && (data.accountEmail || null) !== (before.accountEmail || null)
    if (!email) { if (before.loginEnabled || data.loginEnabled) { data.loginEnabled = false; data.sessionVersion = (before.sessionVersion || 0) + 1 } data.sendInvite = undefined; return data }
    const approved = (data.status ?? before.status) === 'approved'
    if (approved && before.status !== 'approved') data.loginEnabled = true
    const enabled = Boolean(data.loginEnabled ?? before.loginEnabled)
    // A new address or a closed garage signs every device out.
    if ((before.accountEmail && emailChanged) || (before.loginEnabled && !enabled)) data.sessionVersion = (before.sessionVersion || 0) + 1
    if (approved && enabled && (data.sendInvite || !before.loginEnabled || before.status !== 'approved' || emailChanged)) req.context.garageMail = data.sendInvite || emailChanged ? 'invite' : 'auto'
    data.sendInvite = undefined
    return data
  }],
  afterChange: [async ({ doc, req, context }) => {
    const wanted = req.context.garageMail as 'auto' | 'invite' | undefined, notice = req.context.pitNotice as 'live' | 'rejected' | undefined
    if (context.garage || (!wanted && !notice)) return doc
    req.context.garageMail = undefined; req.context.pitNotice = undefined
    if (wanted) {
      const full = await req.payload.findByID({ collection: 'friends', id: doc.id, depth: 0, overrideAccess: true, showHiddenFields: true, req }) as unknown as GarageFriend
      const kind: GarageMail = wanted === 'invite' || !full.passwordHash ? 'invite' : 'approved'
      await sendGarageMail(req.payload, full, kind, req).catch(error => req.payload.logger.error({ err: error }, `PIT GARAGE ${full.tla}: ${kind} mail failed`))
    }
    // A garage approval mail already tells the team they are in; don't send two.
    const to = normalEmail(doc.contact)
    if (notice && to && !(notice === 'live' && wanted)) await sendNoticeMail(req.payload, to, notice, doc, { note: doc.reviewNote })
      .catch(error => req.payload.logger.error({ err: error }, `PIT LANE ${doc.tla}: ${notice} mail failed`))
    return doc
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
    { type: 'row', fields: [
      { name: 'contact', label: 'pitLane.admin.contact', type: 'text', maxLength: 80, access: { read: adminField }, admin: { description: 'pitLane.admin.contactHelp' } },
      { name: 'notify', label: 'pitLane.admin.notify', type: 'checkbox', defaultValue: false, access: { read: adminField }, admin: { description: 'pitLane.admin.notifyHelp' } },
    ] },
    { name: 'status', label: 'ui.reviewStatus', type: 'select', required: true, defaultValue: 'pending', index: true, options: [
      { label: 'ui.pendingReview', value: 'pending' }, { label: 'ui.approved2', value: 'approved' }, { label: 'ui.hidden', value: 'rejected' },
    ], admin: { position: 'sidebar' } },
    { name: 'source', label: 'pitLane.admin.source', type: 'select', defaultValue: 'admin', options: [
      { label: 'pitLane.admin.sourceWeb', value: 'web' }, { label: 'pitLane.admin.sourceEmail', value: 'email' }, { label: 'pitLane.admin.sourceSocial', value: 'social' }, { label: 'GitHub', value: 'github' }, { label: 'pitLane.admin.sourceAdmin', value: 'admin' },
    ], admin: { position: 'sidebar' } },
    { name: 'backlinkAt', label: 'pitLane.admin.backlinkAt', type: 'date', admin: { position: 'sidebar', description: 'pitLane.admin.backlinkAtHelp', date: { pickerAppearance: 'dayOnly' } } },
    { name: 'reviewNote', label: 'pitLane.admin.reviewNote', type: 'textarea', maxLength: 120, admin: { position: 'sidebar', rows: 3, description: 'pitLane.admin.reviewNoteHelp' } },
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
    // Legacy automatic backlink check: no longer read or written.
    { type: 'collapsible', label: 'garage.admin.title', admin: { initCollapsed: false, description: 'garage.admin.help' }, fields: [
      { type: 'row', fields: [
        { name: 'accountEmail', label: 'garage.admin.email', type: 'email', unique: true, index: true, access: { read: adminField } },
        { name: 'loginEnabled', label: 'garage.admin.enabled', type: 'checkbox', defaultValue: false, access: { read: adminField }, admin: { description: 'garage.admin.enabledHelp' } },
      ] },
      { name: 'sendInvite', label: 'garage.admin.invite', type: 'checkbox', virtual: true, admin: { description: 'garage.admin.inviteHelp', condition: data => Boolean(data?.accountEmail) } },
      { type: 'row', fields: [
        { name: 'passwordSetAt', label: 'garage.admin.passwordSetAt', type: 'date', access: { read: adminField, create: () => false, update: () => false }, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'lastLoginAt', label: 'garage.admin.lastLoginAt', type: 'date', access: { read: adminField, create: () => false, update: () => false }, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ] },
    ] },
    // Garage secrets: written only by the garage endpoints (overrideAccess), never readable through the API.
    { name: 'passwordHash', type: 'text', access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'sessionVersion', type: 'number', defaultValue: 0, access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'resetTokenHash', type: 'text', index: true, access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'resetExpires', type: 'date', access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'loginFailures', type: 'number', defaultValue: 0, access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'lockedUntil', type: 'date', access: { read: () => false, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'backlinkCheckedAt', type: 'date', access: { read: adminField }, admin: { hidden: true } },
    // Legacy RSS columns: no longer read or written (friends' updates are not tracked); kept so existing data is not dropped.
    { name: 'feedUrl', type: 'text', access: { read: adminField }, admin: { hidden: true } },
    { name: 'lastPostAt', type: 'date', access: { read: adminField }, admin: { hidden: true } },
    { name: 'feedCheckedAt', type: 'date', access: { read: adminField }, admin: { hidden: true } },
    { name: 'logoCheckedAt', type: 'date', admin: { hidden: true } },
  ],
}
