import { formatCard, type Application } from '@/lib/pit-lane-card'
import { TYRE_COLORS, colorTyre, type Tyre } from '@/lib/pit-lane'

/** Render the clearance card as a PNG for chat apps that strip long text (QQ, Douyin, X DMs). */
export async function clearanceImage(app: Application): Promise<Blob> {
  const W = 1080, H = 1350, canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const body = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const mono = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
  const color = /^#[0-9a-f]{6}$/i.test(app.teamColor) ? app.teamColor : '#2349ed'
  const tyre: Tyre = app.tyre === 'auto' ? colorTyre(color) : app.tyre
  await document.fonts?.ready

  ctx.fillStyle = '#0a0f19'; ctx.fillRect(0, 0, W, H)
  // Pit-lane hatch and a livery stripe down the left edge.
  ctx.save(); ctx.globalAlpha = .06; ctx.strokeStyle = '#fff'; ctx.lineWidth = 18
  for (let x = -H; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke() }
  ctx.restore()
  ctx.fillStyle = color; ctx.fillRect(0, 0, 28, H)
  ctx.fillStyle = '#ffd400'; ctx.fillRect(28, 0, 8, H)

  ctx.fillStyle = '#7f95ff'; ctx.font = `600 26px ${mono}`
  ctx.fillText('HGH PIT LANE · CLEARANCE CARD', 90, 110)
  ctx.fillStyle = '#93a1b8'; ctx.font = `24px ${body}`
  ctx.fillText('P 房入驻申请 · merakt.cn/pit-lane', 90, 152)

  ctx.fillStyle = color; ctx.font = `900 italic 230px ${body}`
  ctx.fillText(app.tla || '???', 82, 400)
  ctx.fillStyle = '#f2f5fb'; ctx.font = `700 52px ${body}`
  ctx.fillText(clip(ctx, app.name || '—', 700), 90, 480)
  ctx.fillStyle = '#9fb4ff'; ctx.font = `28px ${mono}`
  ctx.fillText(clip(ctx, app.url || '—', 700), 90, 530)

  // Tyre roundel
  const cx = 900, cy = 330
  ctx.beginPath(); ctx.arc(cx, cy, 104, 0, Math.PI * 2); ctx.fillStyle = '#16181d'; ctx.fill()
  ctx.lineWidth = 18; ctx.strokeStyle = TYRE_COLORS[tyre]; ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#f2f5fb'; ctx.font = `900 76px ${body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(tyre, cx, cy + 4); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = 'rgba(255,255,255,.06)'; roundRect(ctx, 70, 600, W - 140, 640, 18); ctx.fill()
  ctx.font = `27px ${mono}`
  formatCard(app).split('\n').slice(1, -1).forEach((line, index) => {
    const [label, ...rest] = line.split(': ')
    const y = 670 + index * 64
    ctx.fillStyle = '#8492a8'; ctx.fillText(label, 110, y)
    ctx.fillStyle = '#eef2f8'; ctx.fillText(clip(ctx, rest.join(': '), 560), 410, y)
  })
  ctx.fillStyle = '#5d6b82'; ctx.font = `22px ${mono}`
  ctx.fillText(`ISSUED ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z · SEND TO @real_merakw / QQ 1540180211`, 90, 1300)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas')), 'image/png'))
}

function clip(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1)
  return `${out}…`
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
