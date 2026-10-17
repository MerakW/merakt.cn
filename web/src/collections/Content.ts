import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { adminOnly, editingAccess, publishedOnly, visiblePublished } from '@/lib/access'
import { visibilityFields } from './Flights'

const slugField: Field = { name: 'slug', label: '链接名称', type: 'text', required: true, unique: true, validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || '使用小写字母、数字和连字符。' }
const compoundField: Field = { name: 'compound', label: '轮胎配方', type: 'select', options: [{ label: '自动 · 按文字长度', value: 'auto' }, { label: 'S · 红胎 / 短评', value: 'S' }, { label: 'M · 黄胎 / 日常', value: 'M' }, { label: 'H · 白胎 / 长文', value: 'H' }, { label: 'I · 绿胎 / 心情', value: 'I' }], defaultValue: 'auto' }
const versions = { drafts: { autosave: { interval: 2000 } }, maxPerDoc: 30 }

export const Users: CollectionConfig = {
  slug: 'users', labels: { singular: '管理员', plural: '管理员' }, auth: { tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000 },
  hooks: { beforeDelete: [async ({ id, req }) => {
    await req.payload.delete({ collection: 'passkeys', req, where: { user: { equals: id } } })
    await req.payload.delete({ collection: 'passkey-challenges', req, where: { userID: { equals: id } } })
  }] },
  admin: { useAsTitle: 'name', group: '管理' },
  access: { ...editingAccess, read: adminOnly, admin: adminOnly },
  fields: [{ name: 'name', label: '称呼', type: 'text', required: true }],
}

export const Trips: CollectionConfig = {
  slug: 'trips', labels: { singular: '旅行', plural: '旅行' }, admin: { group: '飞行', useAsTitle: 'title' },
  access: { ...editingAccess, read: visiblePublished }, versions,
  fields: [
    { name: 'title', label: '旅行名称', type: 'text', required: true }, slugField,
    { name: 'description', label: '简短介绍', type: 'textarea' },
    { name: 'cover', label: '封面', type: 'upload', relationTo: 'media' },
    ...visibilityFields,
  ],
}

export const Albums: CollectionConfig = {
  slug: 'albums', labels: { singular: '相册', plural: '毛五相册' }, admin: { group: '内容', useAsTitle: 'title' },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: '相册名称', type: 'text', required: true }, { ...slugField, defaultValue: () => `photo-${Date.now().toString(36)}` },
    { name: 'date', label: '记录日期', type: 'text' },
    { name: 'description', label: '配文', type: 'textarea' },
    compoundField,
    { name: 'cover', label: '封面', type: 'upload', relationTo: 'media' },
    { name: 'photographer', label: '摄影署名', type: 'text' },
    { name: 'photos', label: '照片与短片', type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media', required: true, label: '上传照片或短片' },
      { name: 'caption', type: 'textarea', label: '配文' },
      { name: 'credit', type: 'text', label: '摄影署名' },
      { name: 'source', type: 'text', label: '原始来源' },
    ] },
    { name: 'trip', label: '关联旅行', type: 'relationship', relationTo: 'trips' },
    { name: 'legacyId', type: 'text', unique: true, admin: { hidden: true } },
  ],
}

export const Posts: CollectionConfig = {
  slug: 'posts', labels: { singular: '文章', plural: '博客' }, admin: { group: '内容', useAsTitle: 'title', defaultColumns: ['title', 'date', '_status'] },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true }, slugField,
    { name: 'date', label: '文章日期', type: 'date', required: true },
    { name: 'excerpt', label: '摘要', type: 'textarea' },
    compoundField,
    { name: 'category', label: '分类', type: 'select', options: ['技术', '赛车', '航空', '生活'], defaultValue: '生活' },
    { name: 'cover', label: '封面', type: 'upload', relationTo: 'media' },
    { name: 'body', label: '正文', type: 'richText', required: true },
    { name: 'relatedTrips', label: '关联旅行', type: 'relationship', relationTo: 'trips', hasMany: true },
    { name: 'relatedAlbums', label: '关联相册', type: 'relationship', relationTo: 'albums', hasMany: true },
  ],
}

export const Notes: CollectionConfig = {
  slug: 'notes', labels: { singular: '近况', plural: '最近在干嘛' }, admin: { group: '内容', useAsTitle: 'text', defaultColumns: ['text', 'date', '_status'], description: '最新发布的近况显示在 Team Radio 小窗；在对话列表中添加段落并拖动排序。' },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'text', label: '近况正文', type: 'textarea', required: true, admin: { description: '首页近况正文；未添加 TR 对话时，也用作车手发言。' } },
    { name: 'teamReply', type: 'textarea', admin: { hidden: true } },
    { name: 'radioMessages', label: 'TR 对话 · 按顺序显示', type: 'array', labels: { singular: '发言', plural: '发言' }, admin: { description: '拖动段落调整顺序。车队白色靠左，车手红色靠右。' }, fields: [
      { name: 'speaker', label: '发言方', type: 'select', required: true, defaultValue: 'driver', options: [{ label: '车队 · 白色 / 左侧', value: 'team' }, { label: '车手 · MERAK 51 / 红色 / 右侧', value: 'driver' }] },
      { name: 'message', label: '发言内容', type: 'textarea', required: true },
    ] },
    compoundField,
    { name: 'image', label: '配图', type: 'upload', relationTo: 'media' },
    { name: 'link', label: '相关链接', type: 'text' },
    { name: 'date', label: '日期', type: 'date', required: true },
  ],
}

export const Events: CollectionConfig = {
  slug: 'events', labels: { singular: '活动', plural: '出没日历' }, admin: { group: '内容', useAsTitle: 'title' },
  access: { ...editingAccess, read: publishedOnly }, versions,
  fields: [
    { name: 'title', label: '活动名称', type: 'text', required: true }, slugField,
    { name: 'start', label: '开始时间', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'end', label: '结束时间', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'timeZone', label: '活动时区', type: 'text', defaultValue: 'Asia/Shanghai', required: true },
    { name: 'location', label: '地点', type: 'text' },
    { name: 'description', label: '说明', type: 'textarea' },
    { name: 'cancelled', label: '已取消', type: 'checkbox', defaultValue: false },
    { name: 'url', label: '活动链接', type: 'text' },
  ],
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings', label: '首页与站点设置', access: { read: () => true, update: adminOnly, readVersions: adminOnly },
  versions: { max: 20 },
  fields: [
    { name: 'trackMode', label: '赛道状态', type: 'select', defaultValue: 'auto', options: [{ label: '自动 · 比赛周末', value: 'auto' }, { label: '赛道净空', value: 'clear' }, { label: 'SAFETY CAR · 安全车', value: 'sc' }, { label: 'VSC ENDING · 更新中', value: 'vsc' }, { label: 'IN PIT · 维护中', value: 'pit' }] },
    { name: 'forzaFerrari', label: 'FORZA FERRARI · 手动庆祝', type: 'checkbox', defaultValue: false },
    { name: 'title', label: '站点名称', type: 'text', defaultValue: 'Merak · 数字围场' },
    { name: 'intro', label: '首页介绍', type: 'textarea', defaultValue: '住在杭州，喜欢航空、F1 和 Furry。平时会折腾智能家居，也经常给自己挖点新坑。' },
    { name: 'heroImage', label: '首页主图', type: 'upload', relationTo: 'media' },
    { name: 'featuredAlbum', label: '精选相册', type: 'relationship', relationTo: 'albums' },
    { name: 'pinnedPosts', label: '首页文章顺序', type: 'relationship', relationTo: 'posts', hasMany: true },
    { name: 'showAstronix', label: '显示 Astronix 入口', type: 'checkbox', defaultValue: false },
    { name: 'showAirways', label: '显示 Merak Airways 入口', type: 'checkbox', defaultValue: false },
  ],
}
