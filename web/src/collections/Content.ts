import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { adminOnly, editingAccess, publishedOnly, visiblePublished } from '@/lib/access'
import { maintenanceExpired } from '@/lib/maintenance-time'
import { visibilityFields } from './Flights'

const slugField: Field = { name: 'slug', label: "ui.urlSlug", type: 'text', required: true, unique: true, validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || '使用小写字母、数字和连字符。' }
const compoundField: Field = { name: 'compound', label: "ui.tyreCompound", type: 'select', options: [{ label: "ui.automaticByTextLength", value: 'auto' }, { label: "ui.sSoftQuickThoughts", value: 'S' }, { label: "ui.mMediumEveryday", value: 'M' }, { label: "ui.hHardLongRead", value: 'H' }, { label: "ui.iIntermediateMood", value: 'I' }], defaultValue: 'auto' }
const englishField = (name: string, label: string, type: 'text' | 'textarea' | 'richText' = 'text'): Field => ({ name: name + 'En', label: `admin.translation.${label.toLowerCase()}`, type, admin: { description: 'admin.translation.help' } } as Field)
const versions = { drafts: { autosave: { interval: 2000 } }, maxPerDoc: 30 }

export const Users: CollectionConfig = {
  slug: 'users', labels: { singular: "ui.administrators", plural: "ui.administrators" }, auth: { tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000 },
  hooks: { beforeDelete: [async ({ id, req }) => {
    await req.payload.delete({ collection: 'passkeys', req, where: { user: { equals: id } } })
    await req.payload.delete({ collection: 'passkey-challenges', req, where: { userID: { equals: id } } })
  }] },
  admin: { useAsTitle: 'name', group: "ui.administration" },
  access: { ...editingAccess, read: adminOnly, admin: adminOnly },
  fields: [{ name: 'name', label: "ui.displayName", type: 'text', required: true }],
}

export const Trips: CollectionConfig = {
  slug: 'trips', labels: { singular: "ui.trips", plural: "ui.trips" }, admin: { group: "nav.flights", useAsTitle: 'title' },
  access: { ...editingAccess, read: visiblePublished }, versions,
  fields: [
    { name: 'title', label: "ui.tripTitle", type: 'text', required: true }, slugField,
    { name: 'description', label: "ui.shortDescription", type: 'textarea' },
    { name: 'cover', label: "ui.cover", type: 'upload', relationTo: 'media' },
    ...visibilityFields,
  ],
}

export const Albums: CollectionConfig = {
  slug: 'albums', labels: { singular: "ui.albums", plural: "ui.fursuitFridayAlbums" }, admin: { group: "ui.content", useAsTitle: 'title' },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: "ui.albumTitle", type: 'text', required: true }, { ...slugField, defaultValue: () => `photo-${Date.now().toString(36)}` },
    { name: 'date', label: "ui.date2", type: 'text' },
    { name: 'description', label: "ui.caption", type: 'textarea' },
    englishField('title', 'Title'), englishField('description', 'Caption', 'textarea'),
    compoundField,
    { name: 'cover', label: "ui.cover", type: 'upload', relationTo: 'media' },
    { name: 'photographer', label: "ui.photoCredit", type: 'text' },
    { name: 'photos', label: "ui.photosAndVideos", type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media', required: true, label: "ui.uploadPhotoOrVideo" },
      { name: 'caption', type: 'textarea', label: "ui.caption" }, englishField('caption', 'Caption', 'textarea'),
      { name: 'credit', type: 'text', label: "ui.photoCredit" },
      { name: 'source', type: 'text', label: "ui.originalSource" },
    ] },
    { name: 'trip', label: "ui.relatedTrips", type: 'relationship', relationTo: 'trips' },
    { name: 'legacyId', type: 'text', unique: true, admin: { hidden: true } },
  ],
}

export const Posts: CollectionConfig = {
  slug: 'posts', labels: { singular: "ui.article", plural: "ui.blog" }, admin: { group: "ui.content", useAsTitle: 'title', defaultColumns: ['title', 'date', '_status'] },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: "ui.title", type: 'text', required: true }, slugField,
    { name: 'date', label: "ui.articleDate", type: 'date', required: true },
    { name: 'excerpt', label: "ui.excerpt", type: 'textarea' },
    compoundField,
    { name: 'category', label: "ui.category", type: 'select', options: ['技术', '赛车', '航空', '生活'], defaultValue: '生活' },
    { name: 'cover', label: "ui.cover", type: 'upload', relationTo: 'media' },
    { name: 'body', label: "ui.body", type: 'richText', required: true },
    englishField('title', 'Title'), englishField('excerpt', 'Excerpt', 'textarea'), englishField('body', 'Body', 'richText'),
    { name: 'relatedTrips', label: "ui.relatedTrips", type: 'relationship', relationTo: 'trips', hasMany: true },
    { name: 'relatedAlbums', label: "ui.relatedAlbums", type: 'relationship', relationTo: 'albums', hasMany: true },
  ],
}

export const Notes: CollectionConfig = {
  slug: 'notes', labels: { singular: "ui.statusUpdate", plural: "ui.recentUpdates" }, admin: { group: "ui.content", useAsTitle: 'text', defaultColumns: ['text', 'date', '_status'], description: "ui.theLatestPublishedUpdateAppearsInTeamRadio" },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'text', label: "ui.statusText", type: 'textarea', required: true, admin: { description: "ui.homePageStatusTextUsedAsTheDrivers" } },
    englishField('text', 'Status', 'textarea'),
    { name: 'teamReply', type: 'textarea', admin: { hidden: true } },
    { name: 'radioMessages', label: "ui.trConversationDisplayOrder", type: 'array', labels: { singular: "ui.message3", plural: "ui.message3" }, admin: { description: "ui.dragToReorderTeamMessagesAreWhiteOn" }, fields: [
      { name: 'speaker', label: "ui.speaker", type: 'select', required: true, defaultValue: 'driver', options: [{ label: "ui.teamWhiteLeft", value: 'team' }, { label: "ui.driverMerak51RedRight", value: 'driver' }] },
      { name: 'message', label: "ui.messageText", type: 'textarea', required: true }, englishField('message', 'Message', 'textarea'),
    ] },
    compoundField,
    { name: 'image', label: "ui.image", type: 'upload', relationTo: 'media' },
    { name: 'link', label: "ui.relatedLink", type: 'text' },
    { name: 'date', label: "ui.date3", type: 'date', required: true },
  ],
}

export const Events: CollectionConfig = {
  slug: 'events', labels: { singular: "ui.events", plural: "ui.eventsCalendar" }, admin: { group: "ui.content", useAsTitle: 'title' },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: "ui.eventTitle", type: 'text', required: true }, slugField,
    { name: 'start', label: "ui.startTime", type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'end', label: "ui.endTime", type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'timeZone', label: "ui.eventTimeZone", type: 'text', defaultValue: 'Asia/Shanghai', required: true },
    { name: 'location', label: "ui.location2", type: 'text' },
    { name: 'description', label: "ui.description", type: 'textarea' },
    { name: 'cancelled', label: "flightStatus.cancelled", type: 'checkbox', defaultValue: false },
    { name: 'url', label: "ui.eventLink", type: 'text' },
  ],
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings', label: "ui.homeAndSiteSettings", access: { read: () => true, update: adminOnly, readVersions: adminOnly },
  versions: { max: 20 },
  hooks: { beforeChange: [({ data, originalDoc }) => {
    if (maintenanceExpired(data.trackMode ?? originalDoc?.trackMode, data.maintenanceExpectedExit === undefined ? originalDoc?.maintenanceExpectedExit : data.maintenanceExpectedExit)) { data.trackMode = 'auto'; data.maintenanceExpectedExit = null }
    if (data.trackMode === 'pit' && originalDoc?.trackMode !== 'pit') data.maintenanceStartedAt = new Date().toISOString()
    if (data.trackMode && data.trackMode !== 'pit') data.maintenanceStartedAt = null
    return data
  }], afterRead: [async ({ doc, req, context }) => {
    if (!context.maintenanceAutoExit && maintenanceExpired(doc.trackMode, doc.maintenanceExpectedExit)) {
      const updated = await req.payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, req,
        context: { ...context, maintenanceAutoExit: true },
        data: { trackMode: 'auto', maintenanceStartedAt: null, maintenanceExpectedExit: null }, depth: 0 })
      return { ...doc, trackMode: updated.trackMode, maintenanceStartedAt: null, maintenanceExpectedExit: null, updatedAt: updated.updatedAt }
    }
    return doc
  }] },
  fields: [
    { name: 'trackMode', label: "ui.trackStatus", type: 'select', defaultValue: 'auto', options: [{ label: "ui.automaticRaceWeekend", value: 'auto' }, { label: "ui.trackClear", value: 'clear' }, { label: "ui.safetyCar", value: 'sc' }, { label: "ui.vscEndingUpdating", value: 'vsc' }, { label: "ui.inPitMaintenance", value: 'pit' }] },
    { name: 'maintenanceExpectedExit', label: 'admin.maintenance.expectedExit', type: 'date', admin: { description: 'admin.maintenance.help', condition: data => data.trackMode === 'pit', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'maintenanceStartedAt', type: 'date', admin: { hidden: true } },
    { name: 'forzaFerrari', label: "ui.forzaFerrariManualCelebration", type: 'checkbox', defaultValue: false },
    { name: 'title', label: "ui.siteTitle", type: 'text', defaultValue: 'Merak · 数字围场' },
    { name: 'intro', label: "ui.homeIntroduction", type: 'textarea', defaultValue: '住在杭州，喜欢航空、F1 和 Furry。平时会折腾智能家居，也经常给自己挖点新坑。' },
    { name: 'heroImage', label: "ui.heroImage", type: 'upload', relationTo: 'media' },
    { name: 'featuredAlbum', label: "ui.featuredAlbum", type: 'relationship', relationTo: 'albums' },
    { name: 'pinnedPosts', label: "ui.homePagePostOrder", type: 'relationship', relationTo: 'posts', hasMany: true },
    { name: 'showAstronix', label: "ui.showAstronixLink", type: 'checkbox', defaultValue: false },
    { name: 'showAirways', label: "ui.showMerakAirwaysLink", type: 'checkbox', defaultValue: false },
  ],
}
