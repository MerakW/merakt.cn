import { teamColors, teamLogos, teamLogoSize } from './paddock'
import { westLakePath } from './west-lake-circuit'
export type PassDetails = { mode: 'race' | 'flight'; name: string; team: string; airport: string; city: string; id: string }

async function loadImage(src: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error('图片资源未能载入，请重试。')
  const url = URL.createObjectURL(await response.blob())
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally { URL.revokeObjectURL(url) }
}
export async function saveVisitorPass(details: PassDetails): Promise<Blob> {
  await document.fonts.load('700 32px Formula1')
  await document.fonts.ready
  const race = details.mode === 'race'
  const canvas = document.createElement('canvas')
  canvas.width = race ? 900 : 1800
  canvas.height = race ? 1440 : 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法生成图片。')
  const color = teamColors[details.team] || '#d4e1cf'
  const text = (value: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', face = 'Formula1, sans-serif', maxWidth = canvas.width - 120) => {
    ctx.fillStyle = fill; ctx.textAlign = align
    ctx.font = `700 ${size}px ${face}`
    while (ctx.measureText(value).width > maxWidth && size > 12) { size -= 1; ctx.font = `700 ${size}px ${face}` }
    ctx.fillText(value, x, y)
  }
  if (race) {
    ctx.fillStyle = '#191d1e'; ctx.fillRect(0, 0, 900, 1440)
    ctx.strokeStyle = '#ffffff20'; ctx.lineWidth = 2
    for (let y = -1000; y < 1600; y += 160) { ctx.beginPath(); ctx.moveTo(0, y + 440); ctx.lineTo(900, y); ctx.stroke() }
    ctx.fillStyle = '#070b0c'; ctx.beginPath(); ctx.roundRect(375, 48, 150, 22, 11); ctx.fill()
    text('PADDOCK', 450, 200, 70, color, 'center'); text('CLUB', 450, 280, 70, color, 'center')
    text('HANGZHOU GRAND PRIX', 450, 350, 22, '#f1f2eb', 'center')
    if (teamLogos[details.team]) {
      const logo = await loadImage(`/team-logos/${teamLogos[details.team]}-full-dark.svg`)
      const size = teamLogoSize(details.team)
      const scale = Math.min(size.width * 900/330 / logo.width, size.height * 900/330 / logo.height)
      ctx.drawImage(logo, 450 - logo.width * scale / 2, 485 - logo.height * scale / 2, logo.width * scale, logo.height * scale)
    }
    text(details.team.toUpperCase(), 450, 605, 28, color, 'center')
    ctx.save(); ctx.translate(200, 650); ctx.scale(2.1, 2.1); ctx.strokeStyle = '#f1f2eb'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke(new Path2D(westLakePath)); ctx.restore()
    text('WEST LAKE CIRCUIT', 450, 1000, 21, '#f1f2eb', 'center')
    text('© OpenStreetMap contributors', 450, 1030, 13, '#aab4b8', 'center', 'sans-serif')
    text('GUEST', 450, 1080, 20, '#aab4b8', 'center')
    text(details.name, 450, 1150, 55, '#f1f2eb', 'center', 'sans-serif', 770)
    text(details.id, 450, 1215, 23, '#c5cdca', 'center', 'monospace')
    ctx.fillStyle = color; ctx.fillRect(0, 1270, 900, 105)
    text('PADDOCK ACCESS', 52, 1337, 31, '#111819'); text('51', 844, 1344, 56, '#111819', 'right')
    text('MERAK / HANGZHOU', 450, 1420, 18, '#aab4b8', 'center')
  } else {
    ctx.fillStyle = '#f8fbff'; ctx.fillRect(0, 0, 1800, 720)
    ctx.fillStyle = '#142a4c'; ctx.fillRect(0, 0, 1800, 130)
    text('MERAK AIRWAYS', 70, 83, 45, '#fff'); text('BOARDING PASS', 1725, 80, 32, '#fff', 'right')
    text('PASSENGER', 70, 200, 19, '#61748d'); text(details.name, 70, 255, 40, '#142a4c', 'left', 'sans-serif', 1120)
    text(details.airport, 70, 445, 125, '#244c83'); text('→', 610, 427, 80, '#8ba5c7', 'center', 'sans-serif'); text('HGH', 1160, 445, 125, '#244c83', 'right')
    text(details.city, 75, 490, 23, '#61748d', 'left', 'sans-serif'); text('杭州 · 萧山', 1160, 490, 23, '#61748d', 'right', 'sans-serif')
    text('FLIGHT  MK 518', 75, 585, 24, '#142a4c'); text('GATE  HELLO', 500, 585, 24, '#142a4c'); text('SEAT  1A', 1000, 585, 24, '#142a4c')
    ctx.strokeStyle = '#afc0d7'; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.moveTo(1270, 130); ctx.lineTo(1270, 720); ctx.stroke(); ctx.setLineDash([])
    text('YOU → HGH', 1535, 245, 34, '#142a4c', 'center'); text(details.name, 1535, 320, 32, '#142a4c', 'center', 'sans-serif', 410)
    text('MK 518 / 1A', 1535, 390, 28, '#142a4c', 'center')
    ctx.fillStyle = '#142a4c'
    for (let x = 1350; x < 1720; x += 9) ctx.fillRect(x, 475, x % 3 + 2, 95)
    text(details.id, 75, 675, 22, '#61748d', 'left', 'monospace'); text('MERAK / HANGZHOU', 1535, 655, 18, '#61748d', 'center')
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试。')), 'image/png'))
}
