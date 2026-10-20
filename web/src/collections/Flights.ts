import { savedValueOptions, flightSavedFields } from '@/lib/saved-values'
import { publicFlight } from '@/lib/flights/public'
import type { FlightRecord } from '@/lib/flights/types'
import { APIError, type CollectionBeforeValidateHook, type CollectionConfig, type Field } from 'payload'
import { adminField, editingAccess, visiblePublished } from '@/lib/access'
import { airportMap } from '@/lib/flights/airports'
import { localToUTC, validDate, validateActualTimes } from '@/lib/flights/time'
import { importFlights } from '@/lib/flights/import-endpoint'
import { backfillFlights } from '@/lib/flights/backfill-endpoint'
import { providerQueryEndpoint } from '@/lib/flights/provider-query-endpoint'

export const visibilityFields: Field[] = [
  { name: 'visibility', label: "ui.visibility", type: 'select', defaultValue: 'private', required: true, options: [
    { label: "ui.private", value: 'private' }, { label: "ui.public", value: 'public' }, { label: "ui.publishAtScheduledTime", value: 'scheduled' },
  ], admin: { position: 'sidebar' } },
  { name: 'publishAt', label: "ui.publishTime", type: 'date', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' }, condition: (_, data) => data?.visibility === 'scheduled' } },
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
  const divertedCode = String(doc.divertedTo ?? '').trim().toUpperCase()
  if (divertedCode && !airportMap.has(divertedCode)) throw new APIError('备降机场未收录，请核对 IATA 代码。', 400)
  data.divertedTo = divertedCode || null
  data.departureTimeZone = from.timeZone
  data.arrivalTimeZone = to.timeZone
  try {
    data.departureUTC = doc.departureLocal ? localToUTC(doc.departureLocal, from.timeZone) : null
    data.arrivalUTC = doc.arrivalLocal ? localToUTC(doc.arrivalLocal, to.timeZone) : null
  } catch { throw new APIError('航程时间无效，或位于夏令时切换的歧义区间，请核对。', 400) }
  if (data.departureUTC && data.arrivalUTC && Date.parse(data.arrivalUTC) <= Date.parse(data.departureUTC)) {
    throw new APIError('到达时间必须晚于出发时间，请核对两地日期与时区。', 400)
  }
  try { validateActualTimes(doc) } catch (error) { throw new APIError((error as Error).message, 400) }
  if (doc.visibility === 'scheduled' && (!doc.publishAt || !Number.isFinite(Date.parse(doc.publishAt)))) {
    throw new APIError('指定时间后公开需要填写有效的公开时间。', 400)
  }
  return data
}

export const Flights: CollectionConfig = {
  slug: 'flights', labels: { singular: "ui.flightSegment", plural: "flights.title" },
  admin: { group: "nav.flights", useAsTitle: 'flightNumber', defaultColumns: ['date', 'from', 'to', 'flightNumber', 'state', 'privateDetails', 'visibility'] },
  access: { ...editingAccess, read: visiblePublished },
  endpoints: [{ path: '/saved-values', method: 'get', handler: savedValueOptions('flights', flightSavedFields) }, { path: '/import', method: 'post', handler: importFlights }, { path: '/backfill', method: 'post', handler: backfillFlights }, { path: '/provider-query', method: 'post', handler: providerQueryEndpoint }],
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
    { name: 'importReview', type: 'ui', label: "ui.importReview", admin: { components: {
      Field: './components/admin/FlightImportReview#FlightImportReview',
      Cell: './components/admin/FlightImportReview#FlightImportReviewCell',
    } } },
    { type: 'row', fields: [
      { name: 'date', label: "ui.flightDate", type: 'text', required: true, admin: { description: "ui.localDateAtDepartureAirportEG2026" } },
      { name: 'flightNumber', label: "ui.flightNumber", type: 'text', admin: { components: { Field: './components/admin/SavedValueField' } } },
      { name: 'airline', label: "ui.airline", type: 'text', admin: { components: { Field: './components/admin/SavedValueField' } } },
    ] },
    { name: 'providerLookup', type: 'ui', admin: { components: { Field: './components/admin/FlightProviderLookup#FlightProviderLookup' } } },
    { type: 'row', fields: [
      { name: 'from', label: "ui.departureAirportIata", type: 'text', required: true, admin: { components: { Field: './components/admin/SavedValueField' } } },
      { name: 'to', label: "ui.arrivalAirportIata", type: 'text', required: true, admin: { components: { Field: './components/admin/SavedValueField' } } },
      { name: 'divertedTo', label: "ui.diversionAirportOptional", type: 'text', admin: { components: { Field: './components/admin/SavedValueField' } } },
    ] },
    { name: 'state', label: "ui.recordStatus", type: 'select', required: true, defaultValue: 'unconfirmed', options: [
      { label: "flightStatus.planned", value: 'planned' }, { label: "flightStatus.completed", value: 'completed' }, { label: "flightStatus.cancelled", value: 'cancelled' }, { label: "flightStatus.unconfirmed", value: 'unconfirmed' },
    ], admin: { description: "ui.yourRecordStatusNotTheAirlinesLiveOperational" } },
    { type: 'row', fields: [
      { name: 'departureLocal', label: "ui.scheduledGateDeparture", type: 'text', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
      { name: 'arrivalLocal', label: "ui.scheduledGateArrival", type: 'text', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
    ] },
    { type: 'collapsible', label: "ui.actualTimesGateDepartureTakeoffLandingGateArrival", admin: { initCollapsed: false }, fields: [
      { type: 'row', fields: [
        { name: 'actualDepartureUTC', label: "ui.actualGateDeparture", type: 'date', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
        { name: 'takeoffUTC', label: "ui.actualTakeoffAirborne", type: 'date', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
      ] },
      { type: 'row', fields: [
        { name: 'touchdownUTC', label: "ui.actualLandingTouchdown", type: 'date', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
        { name: 'actualArrivalUTC', label: "ui.actualGateArrival", type: 'date', admin: { components: { Field: './components/admin/FlightTimeField#FlightTimeField' } } },
      ] },
    ] },
    ...['departureUTC', 'arrivalUTC'].map(name => ({ name, type: 'date' as const, admin: { readOnly: true, hidden: true } })),
    ...['departureTimeZone', 'arrivalTimeZone'].map(name => ({ name, type: 'text' as const, admin: { readOnly: true, hidden: true } })),
    { type: 'row', fields: [
      { name: 'aircraft', label: "ui.aircraft2", type: 'text', admin: { components: { Field: './components/admin/SavedValueField' } } }, { name: 'aircraftCode', label: "ui.aircraftCodeIcao", type: 'text', admin: { description: "ui.eGC919B738", components: { Field: './components/admin/SavedValueField' } } }, { name: 'registration', label: "ui.registration", type: 'text', admin: { components: { Field: './components/admin/SavedValueField' } } },
    ] },
    { name: 'trip', label: "ui.trip", type: 'relationship', relationTo: 'trips' },
    { name: 'photos', label: "ui.flightPhotos", type: 'relationship', relationTo: 'media', hasMany: true },
    { name: 'note', label: "ui.publicNotes", type: 'textarea' },
    { name: 'hideSchedule', label: "ui.hideMonthAndDayOfThisUpcomingFlight", type: 'checkbox', defaultValue: false,
      admin: { position: 'sidebar', description: "ui.scheduledFlightsShowDatesAs2026RetainingThe" } },
    ...visibilityFields,
    { name: 'importKey', type: 'text', unique: true, index: true, access: { read: adminField }, admin: { hidden: true } },
    { name: 'sourceId', type: 'text', access: { read: adminField }, admin: { hidden: true } },
    { type: 'collapsible', label: "ui.originalFlightyImportData", admin: { initCollapsed: true }, fields: [
      { name: 'privateDetails', label: "ui.importReview", type: 'json', access: { read: adminField }, admin: { components: { Cell: './components/admin/FlightImportReview#FlightImportReviewCell' }, description: "ui.sourceRecordsBookingReferencesAndSeatsArePrivate" } },
    ] },
  ],
}
