import { airports } from '@/lib/flights/airports'
export const dynamic = 'force-dynamic'
function calculate(params: URLSearchParams) {
 const code=params.get('airport')?.toUpperCase()
 const lat=Number(params.get('lat')),lon=Number(params.get('lon'))
 const distance=(a:number,b:number,c:number,d:number)=>{const r=Math.PI/180,s=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(Math.max(0,1-s)))}
 let airport=code?airports.find(a=>a.iata===code):undefined
 if(!code&&params.has('lat')&&params.has('lon')&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)airport=airports.reduce((best,a)=>distance(lat,lon,a.latitude,a.longitude)<distance(lat,lon,best.latitude,best.longitude)?a:best)
 if(!airport)return Response.json({error:'请输入有效机场三字码。'},{status:400})
 const km=Math.round(distance(code?airport.latitude:lat,code?airport.longitude:lon,30.2741,120.1551))
 return Response.json({city:airport.city,airport:airport.iata,km,minutes:Math.round(km/900*60+60)},{headers:{'Cache-Control':'private, no-store'}})
}

export function GET(request:Request) {
 const code=new URL(request.url).searchParams.get('airport')||''
 return calculate(new URLSearchParams({airport:code}))
}
export async function POST(request:Request) {
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'请求无效。'},{status:400})
 try{
  let size=0;const chunks:Uint8Array[]=[]
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256){await reader.cancel();return Response.json({error:'请求无效。'},{status:413})}chunks.push(value)}
  const data=JSON.parse(Buffer.concat(chunks).toString())
  if(typeof data.lat!=='number'||typeof data.lon!=='number')throw new Error()
  return calculate(new URLSearchParams({lat:String(data.lat),lon:String(data.lon)}))
 }catch{return Response.json({error:'请求无效。'},{status:400})}
}
