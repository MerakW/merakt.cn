import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'
import { submitCheckin } from '@/lib/checkin-submit'
export const Checkins: CollectionConfig = {
  slug: 'checkins', labels: { singular: "ui.checkInMessages", plural: "ui.checkInMessages" },
  admin: { group: "ui.content", useAsTitle: 'name', defaultColumns: ['name','message','status','createdAt'], description: "ui.approvePendingMessagesFromTheListOrSelect" },
  access: { create: adminOnly, update: adminOnly, delete: adminOnly, read: ({req}) => req.user ? true : { status: { equals: 'approved' } } },
  endpoints: [{ path: '/submit', method: 'post', handler: submitCheckin }],
  fields: [
    { name:'name', label:"ui.name", type:'text', required:true, maxLength:40 },
    { name:'message', label:"ui.message2", type:'textarea', required:true, maxLength:500 },
    { name:'status', label:"ui.reviewStatus", type:'select', required:true, defaultValue:'pending', options:[{label:"ui.pendingReview",value:'pending'},{label:"ui.approved2",value:'approved'},{label:"ui.hidden",value:'rejected'}], admin:{position:'sidebar', components:{Cell:'./components/admin/CheckinStatusCell#CheckinStatusCell'}} },
  ],
}
