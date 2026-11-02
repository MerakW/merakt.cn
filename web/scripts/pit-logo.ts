/** Diagnose a friend's logo: `npm run pit:logo -- https://example.com [out.webp]` prints every icon candidate and why it passed or failed. */
import { writeFileSync } from 'node:fs'
import { inspectLogo } from '../src/lib/pit-lane-monitor'

const [url, out] = process.argv.slice(2)
if (!url) { console.error('用法：npm run pit:logo -- https://example.com [输出.webp]'); process.exit(2) }
const { image, attempts, page } = await inspectLogo(url)
console.log(page)
for (const item of attempts) console.log(`  ${item.result.padEnd(24)} ${item.url}`)
if (image && out) writeFileSync(out, image)
console.log(image ? `✓ 抓到 logo${out ? ` → ${out}` : ''}` : '✗ 没有可用的图标')
process.exit(image ? 0 : 1)
