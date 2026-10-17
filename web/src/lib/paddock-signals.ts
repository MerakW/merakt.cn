import { createHmac, randomUUID, timingSafeEqual, randomInt } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
class SignalError extends Error {}
const recent: number[] = []
const senders = new Map<string, number>()
const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'private, no-store'}})
function sign(data: string) { return createHmac('sha256', process.env.PAYLOAD_SECRET!).update(data).digest('base64url') }
async function input(req: PayloadRequest) {
  const origin = req.headers.get('origin')
  const local = process.env.LOCAL_PREVIEW === '1' && origin && new URL(origin).host === req.headers.get('host')
  if (origin !== new URL(req.payload.config.serverURL).origin && !local) throw new SignalError('请从本站发送。')
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new SignalError('请求格式无效。')
  const reader = req.body?.getReader(); if (!reader) throw new SignalError('请求为空。')
  const chunks: Uint8Array[] = []; let size=0
  for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>2048){await reader.cancel();throw new SignalError('请求过长。')}; chunks.push(value) }
  const data = JSON.parse(Buffer.concat(chunks).toString())
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SignalError('请求格式无效。')
  const now=Date.now(); while(recent.length && recent[0]<now-60000)recent.shift()
  if(recent.length>=90)throw new SignalError('无线电繁忙，请稍后重试。');recent.push(now)
  return data
}
export const signalEndpoints: Endpoint[] = [
  {path:'/summary',method:'get',handler:async req=>{
    const china=new Date(Date.now()+8*3600000), monthStart=Date.UTC(china.getUTCFullYear(),china.getUTCMonth(),1)-8*3600000
    const best=async(since:number)=>{
      const rows=await req.payload.find({collection:'paddock-signals',where:{and:[{kind:{equals:'reaction'}},{createdAt:{greater_than_equal:new Date(since).toISOString()}}]},sort:'value',limit:1,depth:0,overrideAccess:true})
      const row=rows.docs[0]; return row ? {ms:row.value,name:row.approved&&row.name?row.name:`GUEST ${String(row.id).padStart(4,'0')}`} : null
    }
    const [month,allTime]=await Promise.all([best(monthStart),best(0)]);return json({month,allTime})
  }},
  {path:'/send',method:'post',handler:async req=>{
    try {
      const data=await input(req)
      const address=req.headers.get('x-real-ip') || 'unknown'
      const key=sign(`${address}:${data.kind}`), now=Date.now()
      const interval=1000
      if(now-(senders.get(key)||0)<interval)throw new SignalError('请稍候再发送。')
      if(senders.size>2000)for(const [id,at] of senders)if(now-at>60000)senders.delete(id)
      senders.set(key,now)
      if(data.kind==='start') {
        const delay=randomInt(200,3001), started=Date.now(), ticket=randomUUID()
        const body=Buffer.from(JSON.stringify({ticket,started,delay})).toString('base64url')
        return json({delay,token:`${body}.${sign(body)}`})
      }
      if(data.kind==='reaction') {
        if(typeof data.token!=='string'||data.token.length>600)throw new SignalError('发车凭证无效，请重新开始。')
        const [body,signature]=data.token.split('.'), expected=sign(body)
        if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new SignalError('发车凭证无效。')
        const token=JSON.parse(Buffer.from(body,'base64url').toString()), elapsed=Date.now()-token.started
        if(!Number.isInteger(data.ms)||data.ms<100||data.ms>10000||elapsed<5000+token.delay+data.ms-100||elapsed>300000)throw new SignalError('成绩无法登记，请重新发车。')
        const name=typeof data.name==='string'?data.name.trim().slice(0,24):''
        const used=await req.payload.count({collection:'paddock-signals',where:{ticket:{equals:token.ticket}},overrideAccess:true})
        if(used.totalDocs)throw new SignalError('这次成绩已登记。')
        await req.payload.create({collection:'paddock-signals',data:{kind:'reaction',value:data.ms,name,ticket:token.ticket},overrideAccess:true})
      } else throw new SignalError('信号无效。')
      return json({accepted:true},201)
    } catch(error) { return json({error:error instanceof SignalError ? error.message : '暂时无法发送，请稍后重试。'},400) }
  }},
]
