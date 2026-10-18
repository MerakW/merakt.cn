import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'

export const FlightSyncJobs: CollectionConfig = {
  slug: 'flight-sync-jobs', labels: { singular: "ui.flightSyncJobs", plural: "ui.flightSyncJobs" }, lockDocuments: false,
  admin: { group: "nav.flights", useAsTitle: 'flightNumber', defaultColumns: ['flightNumber', 'phase', 'flight', 'nextRunAt', 'lastError'], description: "ui.persistentQueueForRadarFetchesAndNextDay" },
  access: { create: () => false, update: () => false, read: adminOnly, delete: adminOnly },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'flightNumber', label: "ui.flightNumber", type: 'text', required: true, admin: { readOnly: true } },
    { name: 'flight', label: "ui.linkedFlight", type: 'relationship', relationTo: 'flights', index: true, admin: { readOnly: true } },
    { name: 'phase', label: "ui.syncStatus", type: 'select', required: true, defaultValue: 'Awaiting_Radar', index: true, options: [
      { label: "ui.awaitingRadarData", value: 'Awaiting_Radar' }, { label: "ui.awaitingGateArrivalCalibration", value: 'Pending_Gate_Calibration' }, { label: "ui.archived", value: 'Archived' }, { label: "ui.needsReview", value: 'Needs_Review' },
    ], admin: { readOnly: true } },
    { name: 'request', label: "ui.matchCriteria", type: 'json', required: true, admin: { readOnly: true } },
    { name: 'calibrationRunAt', label: "ui.firstCalibrationTime", type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'nextRunAt', label: "ui.nextRetry", type: 'date', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'attempts', label: "ui.radarAttempts", type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'calibrationAttempts', label: "ui.calibrationNotificationAttempts", type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastError', label: "ui.latestResult", type: 'text', admin: { readOnly: true } },
    { name: 'evidence', label: "ui.dataSource", type: 'json', admin: { readOnly: true } },
    { name: 'leaseUntil', type: 'date', admin: { hidden: true } },
    { name: 'leaseToken', type: 'text', admin: { hidden: true } },
  ],
}
