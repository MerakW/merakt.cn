import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { signalEndpoints } from '../src/lib/paddock-signals'

test('reaction leaderboard shows submitted names and accepts sub-100ms scores', async () => {
 process.env.PAYLOAD_SECRET ||= 'reaction-unit-test'
 const body = Buffer.from(JSON.stringify({ticket:randomUUID(),started:Date.now()-7000,delay:200})).toString('base64url')
 const token = `${body}.${createHmac('sha256',process.env.PAYLOAD_SECRET).update(body).digest('base64url')}`
 let saved: unknown
 const payload = {
  config:{serverURL:'https://example.test'},
  count:async()=>({totalDocs:0}),
  create:async(input:unknown)=>{saved=input},
  find:async()=>({docs:[{id:1,value:42,name:'Fast driver',approved:false}]}),
 }
 const request = (ms:number) => {
  const web = new Request('https://example.test/api/paddock-signals/send',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json','x-real-ip':String(ms)},body:JSON.stringify({kind:'reaction',ms,name:'Fast driver',token})})
  return {payload,headers:web.headers,body:web.body} as unknown as PayloadRequest
 }
 const accepted = await signalEndpoints[1].handler(request(42))
 assert.equal(accepted.status,201)
 assert.equal((saved as {data:{value:number}}).data.value,42)
 assert.equal((await signalEndpoints[1].handler(request(-1))).status,400)
 const response = await signalEndpoints[0].handler({payload} as unknown as PayloadRequest)
 assert.equal((await response.json()).allTime.name,'Fast driver')
})
