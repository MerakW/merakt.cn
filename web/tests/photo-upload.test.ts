import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import type { PayloadRequest } from 'payload'
import { preparePublishedPhoto } from '../src/lib/photo-upload'
import { captureUploadExif } from '../src/lib/photo-exif'
import { PHOTO_UPLOAD_MAX_BYTES, PHOTO_UPLOAD_MAX_PIXELS } from '../src/lib/photo-upload-limits'
import { hasselbladFixture } from './photo-exif-fixture'

test('publishes a full-resolution 100MP Hasselblad JPEG and captures its EXIF in both upload paths', async () => {
  const original = await hasselbladFixture()
  const source = await sharp(original).metadata()
  assert.equal(source.width! * source.height!, 101896752)
  assert.equal(source.orientation, 6)
  assert.ok(original.length < PHOTO_UPLOAD_MAX_BYTES)
  const prepared = await preparePublishedPhoto(original)
  assert.ok(prepared)
  assert.equal(prepared.exposure.camera, 'Hasselblad X2D 100C')
  assert.equal(prepared.exposure.lens, 'XCD 2,5/55V')
  assert.equal(prepared.exposure.iso, 100)
  const output = await sharp(prepared.image).metadata()
  assert.equal(output.format, 'webp')
  assert.equal(output.width, 1536)
  assert.equal(output.height, 2048)
  assert.equal(output.exif, undefined)
  assert.ok(prepared.image.length < original.length)
  assert.doesNotMatch(JSON.stringify(prepared.exposure), /PRIVATE|Private/)
  const req = { context: {}, file: {data:original,mimetype:'image/jpeg'} } as PayloadRequest
  await captureUploadExif({operation:'create',req} as Parameters<typeof captureUploadExif>[0])
  assert.deepEqual(req.context.mediaUploadExif, prepared.exposure)
})

test('rejects malformed images and resolutions above the bounded 120MP limit', async () => {
  await assert.rejects(preparePublishedPhoto(Buffer.from('invalid image')))
  const oversized = await sharp({create:{width:12001,height:10000,channels:3,background:'#fff'}}).png().toBuffer()
  assert.ok(12001 * 10000 > PHOTO_UPLOAD_MAX_PIXELS)
  await assert.rejects(preparePublishedPhoto(oversized), /pixel limit/)
})
