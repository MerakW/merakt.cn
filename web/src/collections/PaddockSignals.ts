import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'
import { signalEndpoints } from '@/lib/paddock-signals'
export const PaddockSignals: CollectionConfig = {
  slug: 'paddock-signals', labels: { singular: '围场互动', plural: '围场互动' },
  admin: { group: '内容', useAsTitle: 'name', defaultColumns: ['kind','name','value','subject','createdAt'] },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  endpoints: signalEndpoints,
  fields: [
    { name: 'kind', label: '类型', type: 'select', required: true, index: true, options: [{label:'发车成绩',value:'reaction'},{label:'车队回电',value:'radio'}] },
    { name: 'name', label: '访客昵称', type: 'text', maxLength: 24 },
    { name: 'approved', label: '公开昵称', type: 'checkbox', defaultValue: false },
    { name: 'value', label: '反应时间 / ms', type: 'number', min: 100, max: 10000 },
    { name: 'subject', label: '回电内容', type: 'text', maxLength: 120, index: true },
    { name: 'ticket', type: 'text', unique: true, required: true, admin: { hidden: true } },
  ],
}
