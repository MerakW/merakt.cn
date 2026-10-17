import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
export const dynamic='force-dynamic'
export async function GET(){
 const html=await readFile(join(process.cwd(),'scripts/maintenance/in-pit.html'),'utf8').catch(()=>readFile(join(process.cwd(),'maintenance/in-pit.html'),'utf8'))
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
}
