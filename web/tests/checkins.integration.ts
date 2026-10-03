import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { submitCheckin } from '../src/lib/checkin-submit'
const directory = await mkdtemp(join(tmpdir(),'merak-checkin-'))
process.env.PAYLOAD_SECRET = randomUUID()+randomUUID()
process.env.DATABASE_URL = 'file:'+join(directory,'test.db')
process.env.MEDIA_DIR = join(directory,'media')
const {getPayload,createLocalReq} = await import('payload')
const {default:config} = await import('../src/payload.config')
const payload = await getPayload({config})
try {
 const user = await payload.create({collection:'users',data:{name:'Test',email:'checkin@example.invalid',password:randomUUID()}})
 const invoke = async (data:unknown, origin=payload.config.serverURL) => {
  const request=new Request(payload.config.serverURL+'/api/checkins/submit',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)})
  const req=await createLocalReq({},payload);Object.assign(req,{headers:request.headers,body:request.body});return submitCheckin(req)
 }
 const data={name:'测试访客',message:'这是隔离测试',consent:true}
 assert.equal((await invoke({...data,status:'approved'})).status,202)
 let row=(await payload.find({collection:'checkins'})).docs[0]
 assert.equal(row.status,'pending')
 assert.equal((await payload.find({collection:'checkins',overrideAccess:false})).totalDocs,0)
 await assert.rejects(payload.create({collection:'checkins',overrideAccess:false,data:{name:'绕过',message:'拒绝',status:'approved'}}))
 await assert.rejects(payload.update({collection:'checkins',id:row.id,overrideAccess:false,data:{status:'approved'}}))
 assert.equal((await invoke(data,'https://untrusted.invalid')).status,403)
 assert.equal((await invoke({...data,consent:false})).status,400)
 assert.equal((await invoke({...data,message:'x'.repeat(501)})).status,400)
 assert.equal((await invoke({...data,website:'bot'})).status,400)
 assert.equal((await invoke({...data,baseAirport:'PVG',message:''})).status,202)
 const arrival=(await payload.find({collection:'checkins',where:{message:{equals:'BASE PVG → HGH'}}})).docs[0]
 assert.equal(arrival.status,'pending')
 assert.equal((await invoke({...data,baseAirport:'ZZZ'})).status,400)
 assert.equal((await invoke({...data,baseAirport:'HGH',message:'x'.repeat(61)})).status,400)

 await payload.update({collection:'checkins',id:row.id,user:{...user,collection:'users'},overrideAccess:false,data:{status:'approved'}})
 assert.equal((await payload.find({collection:'checkins',overrideAccess:false})).totalDocs,1)
 await payload.update({collection:'checkins',id:row.id,user:{...user,collection:'users'},overrideAccess:false,data:{status:'rejected'}})
 assert.equal((await payload.find({collection:'checkins',overrideAccess:false})).totalDocs,0)
 console.log('PASS: forced moderation, private pending/rejected, anonymous create/update denied, consent, size, origin, honeypot, admin approval')
} finally { await payload.destroy() }
