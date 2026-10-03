// Next copies loaded dotenv files to standalone separately from file tracing.
// Runtime credentials must be injected on the host, never shipped in the image.
import { readdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = '.next/standalone'
for (const name of await readdir(root)) {
  if (name === '.env' || name.startsWith('.env.')) await rm(join(root, name))
}

const forbidden = []
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.name === '.data' || entry.name === '.env' || entry.name.startsWith('.env.') || /\.(?:csv|db|sqlite)(?:-wal|-shm)?$/.test(entry.name)) {
      // Dependencies can contain unrelated examples; application data cannot.
      if (!path.includes('/node_modules/')) forbidden.push(path)
    }
    if (entry.isDirectory()) await inspect(path)
  }
}
await inspect(root)
if (forbidden.length) throw new Error('部署包包含私有数据路径：' + forbidden.join(', '))
const manifest = JSON.parse(await readFile('.next/required-server-files.json', 'utf8'))
if (manifest.config.output !== 'standalone') throw new Error('缺少独立部署配置')
console.log('部署包检查通过：未携带 dotenv、数据库或 CSV；运行时请注入环境变量。')
