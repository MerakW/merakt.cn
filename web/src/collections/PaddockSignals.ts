import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'
import { signalEndpoints } from '@/lib/paddock-signals'
export const PaddockSignals: CollectionConfig = {
  slug: 'paddock-signals', labels: { singular: "ui.paddockInteractions", plural: "ui.paddockInteractions" },
  admin: { group: "ui.content", useAsTitle: 'name', defaultColumns: ['kind','name','value','subject','createdAt'] },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  endpoints: signalEndpoints,
  fields: [
    { name: 'kind', label: "ui.type", type: 'select', required: true, index: true, options: [{label:"ui.startResults",value:'reaction'},{label:"ui.teamReplies",value:'radio'}] },
    { name: 'name', label: "ui.guestNickname", type: 'text', maxLength: 24 },
    { name: 'approved', admin: { hidden: true }, label: "ui.publicNickname", type: 'checkbox', defaultValue: false },
    { name: 'value', label: "ui.reactionTimeMs", type: 'number', min: 0, max: 10000 },
    { name: 'subject', label: "ui.replyText", type: 'text', maxLength: 120, index: true },
    { name: 'ticket', type: 'text', unique: true, required: true, admin: { hidden: true } },
  ],
}
