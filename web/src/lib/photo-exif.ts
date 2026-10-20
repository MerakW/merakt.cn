import exifReader from 'exif-reader'
import sharp from 'sharp'
import type { CollectionBeforeOperationHook, CollectionBeforeValidateHook } from 'payload'
import type { Media } from '@/payload-types'

type Exposure = NonNullable<Media['exposure']>
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').trim().slice(0, limit) : ''
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
const decimal = (value: number) => String(Number(value.toFixed(6)))

/** Only copy photographic settings; raw EXIF, GPS and device identifiers are never stored here. */
export function exposureFromExif(buffer?: Buffer): Exposure {
  if (!buffer?.length) return {}
  try {
    const tags = exifReader(buffer), photo = tags.Photo || {}, image = tags.Image || {}
    const model = text(image.Model, 80), make = text(image.Make, 80).replace(/\s+(corporation|inc\.?)$/i, '')
    const camera = model ? (make && !model.toLowerCase().startsWith(make.toLowerCase()) ? `${make} ${model}` : model).slice(0, 80) : ''
    const lens = text(photo.LensModel, 100)
    const focal = positive(photo.FocalLength), aperture = positive(photo.FNumber), seconds = positive(photo.ExposureTime)
    const sensitivity = positive(photo.ISOSpeedRatings) || positive(photo.RecommendedExposureIndex)
    const iso = sensitivity && Number.isInteger(sensitivity) && sensitivity <= 3276800 ? sensitivity : undefined
    const reciprocal = seconds && Math.round(1 / seconds)
    const shutter = seconds ? (seconds < 1 && reciprocal && Math.abs(seconds * reciprocal - 1) < .01 ? `1/${reciprocal}` : `${decimal(seconds)} s`) : ''
    return {
      ...(camera && { camera }), ...(lens && { lens }), ...(focal && { focalLength: `${decimal(focal)} mm` }),
      ...(aperture && { aperture: decimal(aperture) }), ...(shutter && { shutter }), ...(iso && { iso }),
    }
  } catch { return {} } // Missing or malformed metadata must not stop a valid photo upload.
}

/** Read the original before Payload crops or re-encodes the upload. */
export const captureUploadExif: CollectionBeforeOperationHook = async ({ operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return
  delete req.context.mediaUploadExif
  if (!req.file?.mimetype.startsWith('image/')) return
  try {
    const metadata = await sharp(req.file.tempFilePath || req.file.data, { limitInputPixels: 40_000_000 }).metadata()
    req.context.mediaUploadExif = exposureFromExif(metadata.exif)
  } catch { /* Payload handles invalid image uploads; EXIF is optional. */ }
}

/** Submitted values and previously edited values take priority over detected settings. */
export const fillUploadExposure: CollectionBeforeValidateHook<Media> = ({ data, originalDoc, req }) => {
  const detected = req.context.mediaUploadExif as Exposure | undefined
  delete req.context.mediaUploadExif
  if (!data || !detected || !Object.keys(detected).length) return data
  const exposure: Exposure = { ...originalDoc?.exposure, ...data.exposure }
  if (exposure.medium === 'film') return data
  for (const key of Object.keys(detected) as (keyof Exposure)[]) {
    if (exposure[key] == null || exposure[key] === '') Object.assign(exposure, { [key]: detected[key] })
  }
  return { ...data, exposure }
}
