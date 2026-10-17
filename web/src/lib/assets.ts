/** Public image CDN used by the legacy site. Mirror public/ at the CDN root. */
export const IMAGE_CDN_ORIGIN = process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1' ? '' : 'https://cos.merakt.cn'

export function imageURL(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  if (!IMAGE_CDN_ORIGIN) return path
  // The legacy bucket stores this collection without the /images prefix.
  const cdnPath = path.startsWith('/images/fursuitfriday/') ? path.slice('/images'.length) : path
  return IMAGE_CDN_ORIGIN + cdnPath
}

/** Use the same SVG assets for flight numbers, collections and carrier summaries. */
export function airlineLogoURL(icao: string, wordmark = false): string {
  const file = wordmark && icao === 'CES' ? 'CES-wordmark' : icao
  return imageURL(`/airlines/${file}.svg`)
}

/** Only reviewed public paths from the legacy fursuit collection are accepted. */
export function legacyImageURL(path?: string | null): string | undefined {
  return path && /^\/images\/fursuitfriday\/[A-Za-z0-9_.-]+$/.test(path) ? imageURL(path) : undefined
}
