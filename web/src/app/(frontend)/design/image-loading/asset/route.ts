import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 })
  const mode = new URL(request.url).searchParams.get('mode')
  if (mode !== 'ready') await new Promise(resolve => setTimeout(resolve, 5000))
  const headers = { 'Cache-Control': 'no-store' }
  if (mode === 'failed') return new Response(null, { status: 404, headers })
  const file = await readFile(join(process.cwd(), 'public', 'aircraft', 'A350-900_white.webp'))
  return new Response(new Uint8Array(file), { headers: { ...headers, 'Content-Type': 'image/webp' } })
}
