import { radarRoute } from '@/lib/radar'
export const dynamic = 'force-dynamic'

function respond(input: Parameters<typeof radarRoute>[0]) {
 const route = radarRoute(input)
 return route
  ? Response.json(route, { headers: { 'Cache-Control': 'private, no-store' } })
  : Response.json({error:'请输入有效机场三字码或位置。'}, {status:400})
}

export function GET(request:Request) {
 return respond({code:new URL(request.url).searchParams.get('airport') || ''})
}
export async function POST(request:Request) {
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'请求无效。'},{status:400})
 try{
  let size=0;const chunks:Uint8Array[]=[]
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return Response.json({error:'请求无效。'},{status:413})}chunks.push(value)}
  const data=JSON.parse(Buffer.concat(chunks).toString())
  if(typeof data?.lat!=='number'||typeof data?.lon!=='number'||(data.city!==undefined&&(typeof data.city!=='string'||data.city.length>80)))throw new Error()
  return respond({lat:data.lat,lon:data.lon,city:data.city})
 }catch{return Response.json({error:'请求无效。'},{status:400})}
}
