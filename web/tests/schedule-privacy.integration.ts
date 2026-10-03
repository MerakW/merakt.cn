import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const dir=await mkdtemp(join(tmpdir(),'merak-schedule-'))
process.env.DATABASE_URL='file:'+join(dir,'test.db')
process.env.PAYLOAD_SECRET=randomUUID()+randomUUID()
process.env.MEDIA_DIR=join(dir,'media')
const {getPayload}=await import('payload')
const {default:config}=await import('../src/payload.config')
const payload=await getPayload({config})
try {
 const user=await payload.create({collection:'users',data:{email:'privacy@example.invalid',password:randomUUID(),name:'Privacy QA'}})
 const admin={...user,collection:'users' as const}
 const row=await payload.create({collection:'flights',user:admin,data:{date:'2099-12-31',from:'HGH',to:'NRT',state:'planned',visibility:'public',hideSchedule:true,departureLocal:'2099-12-31T09:30',arrivalLocal:'2099-12-31T13:00',note:'Meet 2099-12-31',_status:'published'}})
 assert.equal(row.date,'2099-12-31')
 const anon=await payload.findByID({collection:'flights',id:row.id,overrideAccess:false})
 assert.equal(anon.date,'2099-**-**')
 assert.equal((anon as unknown as {departureClock:string}).departureClock,'09:30')
 assert.equal((anon as unknown as {arrivalClock:string}).arrivalClock,'13:00')
 assert.equal(anon.departureLocal,undefined)
 assert.equal(anon.departureUTC,undefined)
 const projected=await payload.findByID({collection:'flights',id:row.id,overrideAccess:false,select:{date:true,departureUTC:true,note:true}})
 assert.ok(!JSON.stringify(projected).includes('2099-12-31'))
 assert.ok(!JSON.stringify(anon).includes('2099-12-31'))
 const listing=await payload.find({collection:'flights',overrideAccess:false})
 assert.ok(!JSON.stringify(listing).includes('2099-12-31'))
 const internal=await payload.find({collection:'flights',overrideAccess:false,context:{internalFlightDates:true}})
 assert.equal(internal.docs[0].date,'2099-12-31')
 const own=await payload.findByID({collection:'flights',id:row.id,overrideAccess:false,user:admin})
 assert.equal(own.departureLocal,'2099-12-31T09:30')
 await assert.rejects(payload.update({collection:'flights',id:row.id,overrideAccess:false,data:{hideSchedule:false}}))
 await payload.update({collection:'flights',id:row.id,user:admin,data:{hideSchedule:false}})
 assert.equal((await payload.findByID({collection:'flights',id:row.id,overrideAccess:false})).date,'2099-12-31')
 await payload.update({collection:'flights',id:row.id,user:admin,data:{hideSchedule:true,state:'completed'}})
 assert.equal((await payload.findByID({collection:'flights',id:row.id,overrideAccess:false})).date,'2099-12-31')
 console.log('PASS schedule privacy: anonymous list/detail scrubbed, administrator originals intact, selection retains dates on server, unauthorized toggle denied, toggle off and completed restore dates')
} finally { await payload.destroy() }
