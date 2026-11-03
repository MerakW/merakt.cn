import sharp from 'sharp'
import { LOGO_BADGE_PREFIX } from './pit-lane'

/**
 * Bake a fetched site icon into a uniform 256 px garage badge: an opaque square the card simply rounds.
 * - Transparent glyphs (GitHub cat, AST crown) are trimmed and centred on a plate picked for contrast.
 * - Solid-colour icons (Cloudflare, MDN) are re-padded on their own background colour, so every logo
 *   has the same breathing room and no white slivers show around pre-rounded corners.
 * - Busy, full-bleed icons (photos, gradients) fill the square.
 * Files are named pit-logo-v2-* so the card knows the badge is already composed.
 */
export const BAKED_PREFIX = LOGO_BADGE_PREFIX
const S = 256, LIGHT = { r: 246, g: 247, b: 250 }, DARK = { r: 21, g: 29, b: 44 }
type RGB = { r: number; g: number; b: number }
export type LogoLook = { mode: 'glyph' | 'solid' | 'tile'; plate: RGB }

const lum = ({ r, g, b }: RGB) => { const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[sorted.length >> 1] ?? 0 }

type Raw = { data: Buffer; width: number; height: number }
const at = (raw: Raw, x: number, y: number) => { const i = (y * raw.width + x) * 4; return { r: raw.data[i], g: raw.data[i + 1], b: raw.data[i + 2], a: raw.data[i + 3] } }
const dist = (p: RGB, q: RGB) => Math.hypot(p.r - q.r, p.g - q.g, p.b - q.b)
type Box = { left: number; top: number; width: number; height: number }

function bbox(raw: Raw, area: Box, keep: (p: RGB & { a: number }, x: number, y: number) => boolean): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = area.top; y < area.top + area.height; y++) for (let x = area.left; x < area.left + area.width; x++) if (keep(at(raw, x, y), x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/** Points along the middle 40 % of each edge, a hair inside: skips rounded corners and anti-aliased rims. */
function edgePoints(area: Box) {
  const points: [number, number][] = [], inset = Math.max(1, Math.round(Math.min(area.width, area.height) * 0.02))
  for (let step = 0; step <= 12; step++) {
    const t = 0.3 + step * (0.4 / 12)
    const x = Math.round(area.left + t * (area.width - 1)), y = Math.round(area.top + t * (area.height - 1))
    points.push([x, area.top + Math.min(inset, area.height - 1)], [x, area.top + Math.max(area.height - 1 - inset, 0)], [area.left + Math.min(inset, area.width - 1), y], [area.left + Math.max(area.width - 1 - inset, 0), y])
  }
  return points
}

/** Decide how to present an icon; exported for tests. */
export function analyseLogo(raw: Raw): { look: LogoLook; crop: Box } {
  const full: Box = { left: 0, top: 0, width: raw.width, height: raw.height }
  const corners = [at(raw, 0, 0), at(raw, raw.width - 1, 0), at(raw, 0, raw.height - 1), at(raw, raw.width - 1, raw.height - 1)]
  const area = corners.filter(p => p.a < 32).length >= 3 ? bbox(raw, full, p => p.a > 24) || full : full
  const edge = edgePoints(area).map(([x, y]) => at(raw, x, y))
  const opaque = edge.filter(p => p.a > 200)
  // A rounded-square tile covers ~95 % of its box; a round or irregular glyph (GitHub cat) far less.
  let solidPixels = 0
  for (let y = area.top; y < area.top + area.height; y++) for (let x = area.left; x < area.left + area.width; x++) if (at(raw, x, y).a > 200) solidPixels++
  if (solidPixels >= area.width * area.height * 0.88 && opaque.length >= edge.length * 0.6) {
    const bg = { r: median(opaque.map(p => p.r)), g: median(opaque.map(p => p.g)), b: median(opaque.map(p => p.b)) }
    if (opaque.filter(p => dist(p, bg) <= 48).length >= opaque.length * 0.85) {
      // Rounded tiles may carry white or transparent corners; marks never live there, so skip them.
      const cx = Math.max(2, Math.round(area.width * 0.14)), cy = Math.max(2, Math.round(area.height * 0.14))
      const corner = (x: number, y: number) => (x < area.left + cx || x >= area.left + area.width - cx) && (y < area.top + cy || y >= area.top + area.height - cy)
      const glyph = bbox(raw, area, (p, x, y) => p.a > 160 && dist(p, bg) > 48 && !corner(x, y))
      if (glyph && glyph.width * glyph.height < area.width * area.height * 0.92) return { look: { mode: 'solid', plate: bg }, crop: glyph }
    }
    return { look: { mode: 'tile', plate: bg }, crop: area }
  }
  // Transparent glyph: plate with the better contrast against its average ink.
  let weight = 0, sum = 0
  for (let y = area.top; y < area.top + area.height; y++) for (let x = area.left; x < area.left + area.width; x++) { const p = at(raw, x, y); if (p.a > 128) { weight++; sum += lum(p) } }
  const ink = weight ? sum / weight : 0
  const plate = contrast(ink, lum(LIGHT)) >= contrast(ink, lum(DARK)) * 0.8 ? LIGHT : DARK
  return { look: { mode: 'glyph', plate }, crop: area }
}

export async function bakeLogo(input: Buffer, sourceSize: number): Promise<Buffer> {
  // Pixel-art favicons stay crisp; everything else resamples smoothly.
  const kernel = sourceSize <= 48 ? 'nearest' : 'lanczos3'
  const { data, info } = await sharp(input, { density: 300 }).ensureAlpha().resize(S, S, { fit: 'inside', kernel }).raw().toBuffer({ resolveWithObject: true })
  const raw: Raw = { data, width: info.width, height: info.height }
  const { look, crop } = analyseLogo(raw)
  const background = { ...look.plate, alpha: 1 }
  const piece = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(crop)
  if (look.mode === 'tile') return sharp(await piece.flatten({ background: look.plate }).png().toBuffer()).resize(S, S, { fit: 'cover', kernel }).webp({ quality: 90 }).toBuffer()
  // Squarish marks get 64 % of the badge, wordmarks up to 80 % of the width.
  const wide = crop.width / crop.height > 1.6, box = Math.round(S * (wide ? 0.8 : 0.64))
  const glyph = await sharp(await (look.mode === 'solid' ? piece.flatten({ background: look.plate }) : piece).png().toBuffer())
    .resize(box, wide ? Math.round(S * 0.5) : box, { fit: 'inside', kernel }).png().toBuffer()
  return sharp({ create: { width: S, height: S, channels: 4, background } }).composite([{ input: glyph, gravity: 'centre' }]).flatten({ background: look.plate }).webp({ quality: 90 }).toBuffer()
}
