import { cardClientScript } from '@/lib/card-client'
export function GET() { return new Response(cardClientScript, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }) }
