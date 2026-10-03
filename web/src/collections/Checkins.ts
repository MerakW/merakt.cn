import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/lib/access'
import { submitCheckin } from '@/lib/checkin-submit'
export const Checkins: CollectionConfig = {
  slug: 'checkins', labels: { singular: '值机留言', plural: '值机留言' },
  admin: { group: '内容', useAsTitle: 'name', defaultColumns: ['name','message','status','createdAt'], description: '访客提交默认待审核。只有状态为「通过」的留言才会公开。' },
  access: { create: adminOnly, update: adminOnly, delete: adminOnly, read: ({req}) => req.user ? true : { status: { equals: 'approved' } } },
  endpoints: [{ path: '/submit', method: 'post', handler: submitCheckin }],
  fields: [
    { name:'name', label:'名字', type:'text', required:true, maxLength:40 },
    { name:'message', label:'留言', type:'textarea', required:true, maxLength:500 },
    { name:'status', label:'审核状态', type:'select', required:true, defaultValue:'pending', options:[{label:'待审核',value:'pending'},{label:'通过',value:'approved'},{label:'不公开',value:'rejected'}], admin:{position:'sidebar'} },
  ],
}
