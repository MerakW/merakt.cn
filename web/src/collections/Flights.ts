import { publicFlight } from '@/lib/flights/public'
import type { FlightRecord } from '@/lib/flights/types'
import { APIError, type CollectionBeforeValidateHook, type CollectionConfig, type Field } from 'payload'
import { adminField, editingAccess, visiblePublished } from '@/lib/access'
import { airportMap } from '@/lib/flights/airports'
import { localToUTC, validDate } from '@/lib/flights/time'
import { importFlights } from '@/lib/flights/import-endpoint'

export const visibilityFields: Field[] = [
  { name: 'visibility', label: '公开范围', type: 'select', defaultValue: 'private', required: true, options: [
    { label: '仅自己可见', value: 'private' }, { label: '公开', value: 'public' }, { label: '指定时间后公开', value: 'scheduled' },
  ], admin: { position: 'sidebar' } },
  { name: 'publishAt', label: '公开时间', type: 'date', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' }, condition: (_, data) => data?.visibility === 'scheduled' } },
]

const normalizeFlight: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const doc = { ...originalDoc, ...data }
  // Autosave may contain incomplete fields. Publishing always validates the full record.
  if (doc._status === 'draft') return data
  if (!validDate(doc.date ?? '')) throw new APIError('请填写有效的航程日期（YYYY-MM-DD）。', 400)
  for (const field of ['from', 'to'] as const) {
    const code = String(doc[field] ?? '').trim().toUpperCase()
    if (!airportMap.has(code)) throw new APIError(`机场 ${code || '未填写'} 未收录，请核对 IATA 代码。`, 400)
    data[field] = code
  }
  const from = airportMap.get(data.from)!
  const to = airportMap.get(data.to)!
  data.departureTimeZone = from.timeZone
  data.arrivalTimeZone = to.timeZone
  try {
    data.departureUTC = doc.departureLocal ? localToUTC(doc.departureLocal, from.timeZone) : null
    data.arrivalUTC = doc.arrivalLocal ? localToUTC(doc.arrivalLocal, to.timeZone) : null
  } catch { throw new APIError('航程时间无效，或位于夏令时切换的歧义区间，请核对。', 400) }
  if (data.departureUTC && data.arrivalUTC && Date.parse(data.arrivalUTC) <= Date.parse(data.departureUTC)) {
    throw new APIError('到达时间必须晚于出发时间，请核对两地日期与时区。', 400)
  }
  if (doc.visibility === 'scheduled' && (!doc.publishAt || !Number.isFinite(Date.parse(doc.publishAt)))) {
    throw new APIError('指定时间后公开需要填写有效的公开时间。', 400)
  }
  return data
}

export const Flights: CollectionConfig = {
  slug: 'flights', labels: { singular: '航段', plural: '飞行记录' },
  admin: { group: '飞行', useAsTitle: 'flightNumber', defaultColumns: ['date', 'from', 'to', 'flightNumber', 'state', 'visibility'] },
  access: { ...editingAccess, read: visiblePublished },
  endpoints: [{ path: '/import', method: 'post', handler: importFlights }],
  versions: { drafts: { autosave: { interval: 2000 } }, maxPerDoc: 20 },
  hooks: { beforeValidate: [normalizeFlight], afterRead: [async ({doc,req,context}) => {
    if (req.user || context.internalFlightDates) return doc
    // A public `select` may omit the privacy flag; never let projection bypass it.
    const policy = doc.hideSchedule === undefined || doc.state === undefined
      ? await req.payload.findByID({ collection: 'flights', id: doc.id, overrideAccess: false, depth: 0,
          context: { ...context, internalFlightDates: true }, select: { hideSchedule: true, state: true } })
      : doc
    if (policy.hideSchedule && policy.state === 'planned') {
      return { ...publicFlight({ ...doc, hideSchedule: true, state: 'planned' } as FlightRecord), hideSchedule: true, visibility: doc.visibility, _status: doc._status }
    }
    return doc
  }] },
  fields: [
    { type: 'row', fields: [
      { name: 'date', label: '航程日期', type: 'text', required: true, admin: { description: '出发机场当地日期，例如 2026-09-29。' } },
      { name: 'flightNumber', label: '航班号', type: 'text' },
      { name: 'airline', label: '航空公司', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'from', label: '出发机场（IATA）', type: 'text', required: true },
      { name: 'to', label: '到达机场（IATA）', type: 'text', required: true },
      { name: 'divertedTo', label: '备降机场（可选）', type: 'text' },
    ] },
    { name: 'state', label: '记录状态', type: 'select', required: true, defaultValue: 'unconfirmed', options: [
      { label: '计划中', value: 'planned' }, { label: '已完成', value: 'completed' }, { label: '已取消', value: 'cancelled' }, { label: '待确认', value: 'unconfirmed' },
    ], admin: { description: '这里是你的记录状态，不代表航空公司的实时运行状态。' } },
    { type: 'row', fields: [
      { name: 'departureLocal', label: '计划出发（当地时间）', type: 'text', admin: { description: '可留空；格式 2026-09-29T09:30。' } },
      { name: 'arrivalLocal', label: '计划到达（当地时间）', type: 'text' },
    ] },
    ...['departureUTC', 'arrivalUTC', 'actualDepartureUTC', 'actualArrivalUTC'].map(name => ({ name, type: 'date' as const, admin: { readOnly: true, hidden: true } })),
    ...['departureTimeZone', 'arrivalTimeZone'].map(name => ({ name, type: 'text' as const, admin: { readOnly: true, hidden: true } })),
    { type: 'row', fields: [
      { name: 'aircraft', label: '机型', type: 'text' }, { name: 'registration', label: '注册号', type: 'text' },
    ] },
    { name: 'trip', label: '所属旅行', type: 'relationship', relationTo: 'trips' },
    { name: 'photos', label: '航程照片', type: 'relationship', relationTo: 'media', hasMany: true },
    { name: 'note', label: '公开备注', type: 'textarea' },
    { name: 'hideSchedule', label: '隐藏此段未来行程的月日', type: 'checkbox', defaultValue: false,
      admin: { position: 'sidebar', description: '计划中的航段以 2026.**.** 显示日期，保留年份和当地起降时刻；完整日期、时间戳和备注不对访客公开。改为已完成后恢复日期；后台始终保留原始数据。' } },
    ...visibilityFields,
    { name: 'importKey', type: 'text', unique: true, index: true, access: { read: adminField }, admin: { hidden: true } },
    { name: 'sourceId', type: 'text', access: { read: adminField }, admin: { hidden: true } },
    { name: 'privateDetails', label: '私有导入信息', type: 'json', access: { read: adminField }, admin: { description: '原始记录、订票编号、座位等仅你可见。' } },
  ],
}
