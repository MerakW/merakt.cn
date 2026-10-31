import sharp from 'sharp'
import { exposureFromExif } from './photo-exif'
import { PHOTO_UPLOAD_MAX_PIXELS } from './photo-upload-limits'

export async function preparePublishedPhoto(original: Buffer) {
  const input = sharp(original, { limitInputPixels: PHOTO_UPLOAD_MAX_PIXELS, failOn: 'error' })
  const metadata = await input.metadata()
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format || '') || (metadata.pages || 1) > 1) return null
  const exposure = exposureFromExif(metadata.exif)
  // Apply EXIF orientation before stripping metadata from the published image.
  const image = await input.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  return { image, exposure }
}
