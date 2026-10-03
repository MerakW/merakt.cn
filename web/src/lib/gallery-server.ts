import { getPayload } from 'payload'
import config from '@payload-config'
import { publicAlbum } from './gallery'

export async function getGallery() {
  const payload = await getPayload({ config })
  const records = []
  let page = 1
  for (;;) {
    const result = await payload.find({ collection: 'albums', overrideAccess: false, depth: 1, sort: '-date', limit: 100, page })
    records.push(...result.docs.flatMap(doc => { const item = publicAlbum(doc); return item ? [item] : [] }))
    if (!result.hasNextPage) break
    page++
  }
  return records
}
