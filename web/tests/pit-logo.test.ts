import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { analyseLogo, bakeLogo, BAKED_PREFIX } from '../src/lib/pit-logo'
import { teamInk } from '../src/lib/pit-lane'

const S = 64
function canvas(fill: (x: number, y: number) => [number, number, number, number]) {
  const data = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) data.set(fill(x, y), (y * S + x) * 4)
  return { data, width: S, height: S }
}
const inside = (x: number, y: number, a: number, b: number) => x >= a && x < b && y >= a && y < b
const disc = (x: number, y: number, r: number) => (x - 31.5) ** 2 + (y - 31.5) ** 2 <= r * r

test('transparent dark glyphs are trimmed and sit on the light plate', () => {
  const { look, crop } = analyseLogo(canvas((x, y) => disc(x, y, 12) ? [20, 20, 20, 255] : [0, 0, 0, 0]))
  assert.equal(look.mode, 'glyph')
  assert.deepEqual(look.plate, { r: 246, g: 247, b: 250 })
  assert.deepEqual(crop, { left: 20, top: 20, width: 24, height: 24 })
})

test('transparent white glyphs get the dark plate', () => {
  const { look } = analyseLogo(canvas((x, y) => disc(x, y, 22) ? [255, 255, 255, 255] : [0, 0, 0, 0]))
  assert.equal(look.mode, 'glyph')
  assert.deepEqual(look.plate, { r: 21, g: 29, b: 44 })
})

test('solid icons keep their own colour and crop to the mark, ignoring rounded corners', () => {
  const orange: [number, number, number, number] = [244, 129, 32, 255]
  const { look, crop } = analyseLogo(canvas((x, y) => {
    if ((x < 3 || x > 60) && (y < 3 || y > 60)) return [255, 255, 255, 255]
    return inside(x, y, 16, 48) ? [255, 255, 255, 255] : orange
  }))
  assert.equal(look.mode, 'solid')
  assert.deepEqual(look.plate, { r: 244, g: 129, b: 32 })
  assert.deepEqual(crop, { left: 16, top: 16, width: 32, height: 32 })
})

test('busy full-bleed icons fill the badge', () => {
  const { look } = analyseLogo(canvas((x, y) => [(x * 37 + y * 11) % 256, (x * 7 + y * 53) % 256, (x * y) % 256, 255]))
  assert.equal(look.mode, 'tile')
})

test('baked badges are opaque 256 px squares with breathing room', async () => {
  const icon = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer()
  const badge = await bakeLogo(icon, 32)
  const { data, info } = await sharp(badge).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, 256)
  assert.equal(info.height, 256)
  // A fully black square is treated as a tile and fills the badge.
  assert.ok(data[0] < 10)
  const glyph = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#000"/></svg>')
  const plate = await sharp(await bakeLogo(glyph, 64)).raw().toBuffer({ resolveWithObject: true })
  const px = (x: number, y: number) => plate.data[(y * 256 + x) * plate.info.channels]
  assert.ok(px(8, 8) > 230, 'corner shows the light plate')
  assert.ok(px(128, 128) < 30, 'glyph is centred')
  assert.ok(px(36, 128) > 230, 'glyph is padded, not edge to edge')
  assert.match(`${BAKED_PREFIX}mrk.webp`, /^pit-logo-v2-/)
})

test('team ink lifts dark liveries but leaves bright ones alone', () => {
  assert.equal(teamInk('#e10600'), '#e10600')
  assert.notEqual(teamInk('#5a1020'), '#5a1020')
})
