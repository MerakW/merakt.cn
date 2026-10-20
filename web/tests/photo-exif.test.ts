import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { exposureFromExif } from '../src/lib/photo-exif'

import { exifFixture } from './photo-exif-fixture'

test('copies only camera settings from real EXIF, before image compression strips it', async () => {
  const original = await exifFixture()
  const metadata = await sharp(original).metadata()
  const exposure = exposureFromExif(metadata.exif)
  assert.deepEqual(exposure,{camera:'Canon EOS R5',lens:'RF 85mm F1.2 L',focalLength:'85 mm',aperture:'2.8',shutter:'1/250',iso:400})
  const compressed = await sharp(original).rotate().webp().toBuffer()
  assert.equal((await sharp(compressed).metadata()).exif,undefined)
  assert.equal(exposure.camera,'Canon EOS R5')
  assert.doesNotMatch(JSON.stringify(exposure),/PRIVATE|GPS|author|31\/1/)
})

test('missing, malformed or unusable EXIF leaves settings empty; long exposures remain readable', async () => {
  assert.deepEqual(exposureFromExif(),{})
  assert.deepEqual(exposureFromExif(Buffer.from('invalid EXIF')), {})
  const image=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).withExif({IFD0:{Make:'Sony',Model:'ILCE-7M4'},IFD2:{ExposureTime:'5/2',FNumber:'0/1',ISOSpeedRatings:'0'}}).jpeg().toBuffer()
  assert.deepEqual(exposureFromExif((await sharp(image).metadata()).exif),{camera:'Sony ILCE-7M4',shutter:'2.5 s'})
})
