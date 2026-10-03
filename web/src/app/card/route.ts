import { cardHTML } from '@/lib/card-html'
export function GET() { return new Response(cardHTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) }
