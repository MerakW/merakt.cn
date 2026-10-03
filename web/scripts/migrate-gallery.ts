import { readFile, readdir, access, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('../Legacy/astro-site/src/content/fursuitfriday')
const root = resolve('../Legacy/astro-site/public/images/fursuitfriday')
const rows = await Promise.all((await readdir(source)).filter(name => name.endsWith('.json')).sort().map(async name => {
  const row = JSON.parse(await readFile(resolve(source, name), 'utf8')) as { tweetId: string; time: string; caption: string; image: string; source: string }
  if (!/^\d+$/.test(row.tweetId) || !row.image.startsWith('/images/fursuitfriday/')) throw new Error(`无效源记录：${name}`)
  const path = resolve('../Legacy/astro-site/public', '.' + row.image)
  if (!path.startsWith(root + '/')) throw new Error(`无效媒体路径：${name}`)
  await access(path)
  return { ...row, path }
}))
console.log(`源记录 ${rows.length} 条；媒体路径检查通过。`)
if (!process.argv.includes('--apply')) { console.log('预检查完成。传入 --apply 写入；执行前备份数据库。'); process.exit(0) }

const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
const report = { source: rows.length, mediaCreated: 0, albumsCreated: 0, albumsSkipped: 0 }
try {
  for (const row of rows) {
    const existing = await payload.find({ collection: 'albums', where: { legacyId: { equals: row.tweetId } }, limit: 1, depth: 0 })
    if (existing.totalDocs) { report.albumsSkipped++; continue }
    const credit = row.caption.match(/(?:📷|摄影)\s*[：:]\s*([^\n]+)/)?.[1]?.trim()
    const found = await payload.find({ collection: 'media', where: { legacyPath: { equals: row.image } }, limit: 1 })
    let media = found.docs[0]
    if (!media) {
      media = await payload.create({ collection: 'media', filePath: row.path, data: { alt: row.caption.split('\n')[0] || 'Merak 的毛五记录', credit, source: row.source, visibility: 'public', legacyPath: row.image } })
      report.mediaCreated++
    }
    await payload.create({ collection: 'albums', data: {
      title: row.caption.split('\n')[0] || `毛五 · ${row.time.slice(0, 10)}`, slug: `ff-${row.tweetId}`, date: row.time,
      description: row.caption, cover: media.id, photographer: credit, legacyId: row.tweetId,
      photos: [{ image: media.id, caption: row.caption, credit, source: row.source }], _status: 'published',
    } })
    report.albumsCreated++
  }
  await writeFile('.data/gallery-migration-report.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log(report)
} finally { await payload.destroy() }
