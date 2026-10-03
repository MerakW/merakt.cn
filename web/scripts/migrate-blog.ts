import { readFile } from 'node:fs/promises'
import type { Post } from '../src/payload-types'

// The content export stays outside Git; provide its path explicitly.
const filename = process.argv[2]
if (!filename) throw new Error('用法：node --import tsx scripts/migrate-blog.ts /path/to/post.json')
const post = JSON.parse(await readFile(filename, 'utf8')) as Pick<Post, 'title' | 'slug' | 'date' | 'category' | 'excerpt' | 'body'>
if (!post.title || !post.slug || !post.body) throw new Error('文章需要 title、slug 和 body')
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const found = await payload.find({ collection: 'posts', where: { slug: { equals: post.slug } }, limit: 1 })
  if (found.totalDocs) console.log('文章已存在，保留现有内容。')
  else {
    await payload.create({ collection: 'posts', data: { ...post, _status: 'draft' } })
    console.log('文章已导入为草稿。')
  }
} finally { await payload.destroy() }
