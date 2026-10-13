import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'

export const FlightSyncJobs: CollectionConfig = {
  slug: 'flight-sync-jobs', labels: { singular: '航班同步任务', plural: '航班同步任务' }, lockDocuments: false,
  admin: { group: '飞行', useAsTitle: 'flightNumber', defaultColumns: ['flightNumber', 'phase', 'flight', 'nextRunAt', 'lastError'], description: '雷达抓取与次日入位校准的持久化队列。服务重启后继续处理到期任务。' },
  access: { create: () => false, update: () => false, read: adminOnly, delete: adminOnly },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'flightNumber', label: '航班号', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'flight', label: '对应航段', type: 'relationship', relationTo: 'flights', index: true, admin: { readOnly: true } },
    { name: 'phase', label: '同步状态', type: 'select', required: true, defaultValue: 'Awaiting_Radar', index: true, options: [
      { label: '等待雷达数据', value: 'Awaiting_Radar' }, { label: '等待入位校准', value: 'Pending_Gate_Calibration' }, { label: '已归档', value: 'Archived' }, { label: '需要核对', value: 'Needs_Review' },
    ], admin: { readOnly: true } },
    { name: 'request', label: '匹配条件', type: 'json', required: true, admin: { readOnly: true } },
    { name: 'calibrationRunAt', label: '首次校准时间', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'nextRunAt', label: '下次重试时间', type: 'date', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'attempts', label: '雷达尝试次数', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'calibrationAttempts', label: '校准通知尝试次数', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastError', label: '最近结果', type: 'text', admin: { readOnly: true } },
    { name: 'evidence', label: '数据来源', type: 'json', admin: { readOnly: true } },
    { name: 'leaseUntil', type: 'date', admin: { hidden: true } },
    { name: 'leaseToken', type: 'text', admin: { hidden: true } },
  ],
}
