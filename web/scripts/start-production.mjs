import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareRuntime } from './prepare-runtime.mjs'

const releaseDir = dirname(fileURLToPath(import.meta.url))
try {
  const prepared = prepareRuntime(process.env, releaseDir)
  if (prepared.backup) console.log('数据库迁移前备份：', prepared.backup)
  const child = spawn(process.execPath, [join(releaseDir, 'server.js')], { cwd: releaseDir, env: prepared.env, stdio: 'inherit' })
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => child.kill(signal))
  child.on('error', err => { console.error(err.message); process.exitCode = 1 })
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1) })
} catch (err) {
  console.error('启动检查失败：', err.message)
  process.exitCode = 1
}
