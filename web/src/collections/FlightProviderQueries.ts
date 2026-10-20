import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'

export const FlightProviderQueries: CollectionConfig = {
  slug: 'flight-provider-queries', lockDocuments: false,
  labels: { singular: { zh: '付费航班查询', en: 'Paid flight query' }, plural: { zh: '付费查询记录', en: 'Paid query history' } },
  admin: { group: { zh: '飞行', en: 'Flights' }, useAsTitle: 'flightNumber', defaultColumns: ['flightNumber', 'date', 'status', 'costFen', 'createdAt'], description: { zh: '查询确认与费用预留记录。运行中断后不会自动再次付费。', en: 'Confirmed query reservations. Interrupted queries are never automatically charged again.' } },
  access: { read: adminOnly, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'key', type: 'text', unique: true, required: true, admin: { hidden: true } },
    { name: 'flightNumber', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'date', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'status', type: 'select', required: true, index: true, options: [
      { label: { zh: '等待家庭端', en: 'Queued' }, value: 'queued' }, { label: { zh: '正在查询', en: 'Running' }, value: 'running' },
      { label: { zh: '已返回', en: 'Completed' }, value: 'completed' }, { label: { zh: '失败', en: 'Failed' }, value: 'failed' }, { label: { zh: '结果未知，请核对', en: 'Unknown; review required' }, value: 'unknown' },
    ], admin: { readOnly: true } },
    { name: 'costFen', type: 'number', required: true, label: { zh: '预留费用（分，非账单）', en: 'Reserved cost (fen; not an invoice)' }, admin: { readOnly: true } },
    { name: 'requestedBy', type: 'number', required: true, admin: { readOnly: true } },
    { name: 'flights', type: 'json', admin: { readOnly: true } },
    { name: 'errorCode', type: 'text', admin: { readOnly: true } },
    { name: 'startedAt', type: 'date', admin: { readOnly: true } },
    { name: 'leaseToken', type: 'text', access: { read: () => false }, admin: { hidden: true } },
  ],
}
