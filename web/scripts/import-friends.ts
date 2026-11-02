import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseCard } from '../src/lib/pit-lane-card'
import { RESERVED_TLAS, TLA_PATTERN, type FriendTyre } from '../src/lib/pit-lane'

// Import friends/<TLA>.yml (merged GitHub PRs) as pending Pit Lane applications. Existing TLAs are left untouched.
const dir = resolve(process.argv[2] || '../friends')
const files = (await readdir(dir)).filter(name => /^[A-Z]{3}\.ya?ml$/.test(name))
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
let created = 0
try {
  for (const file of files) {
    const card = parseCard(await readFile(resolve(dir, file), 'utf8'))
    const tla = card.tla || file.slice(0, 3)
    if (!TLA_PATTERN.test(tla) || RESERVED_TLAS.has(tla) || !card.name || !card.url?.startsWith('https://')) { console.warn(`跳过 ${file}：缺少有效的 tla / name / https url`); continue }
    if ((await payload.count({ collection: 'friends', where: { tla: { equals: tla } }, overrideAccess: true })).totalDocs) { console.log(`${tla} 已存在，跳过`); continue }
    const tyre = card.tyre && card.tyre !== 'auto' ? card.tyre as FriendTyre : undefined
    await payload.create({ collection: 'friends', overrideAccess: true, data: {
      tla, name: card.name.slice(0, 40), url: card.url, teamColor: card.teamColor || '#2349ed', bio: card.bio?.slice(0, 40), coolingMsg: card.coolingMsg?.slice(0, 24), backlinkUrl: card.backlinkUrl,
      tyreMode: tyre ? 'manual' : 'auto', tyre, logoSource: 'auto', status: 'pending', maintenance: false, source: 'github',
    } })
    created++; console.log(`${tla} · ${card.name} → 待审核`)
  }
  console.log(`完成：新增 ${created} 条，共读取 ${files.length} 个文件。`)
} finally { await payload.destroy() }
