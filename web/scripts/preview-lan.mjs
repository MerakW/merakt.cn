import { networkInterfaces } from 'node:os'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const database = resolve(root, '.data/paddock-preview/merak.db')
if (!existsSync(database)) {
  console.error('缺少完整数据预览快照：.data/paddock-preview/merak.db。请先从本地数据库制作 SQLite 在线备份。')
  process.exit(1)
}
const interfaces = Object.entries(networkInterfaces()).sort(([a],[b]) => (a === 'en0' ? -1 : b === 'en0' ? 1 : a.localeCompare(b)))
const address = interfaces.filter(([name])=> !/^(utun|tun|tap|docker|veth|bridge)/.test(name)).flatMap(([,entries])=>entries || []).find(entry=>entry.family === 'IPv4' && !entry.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address))?.address
if (!address) {
  console.error('没有找到局域网 IPv4 地址。请连接 Wi-Fi 或有线网络后重试。')
  process.exit(1)
}
const port = '3003'
const env = {
  ...process.env,
  DATABASE_URL: `file:${database}`,
  MEDIA_DIR: resolve(root,'.data/media'),
  SERVER_URL: `http://${address}:${port}`,
  NEXT_DIST_DIR: '.next-qa',
  LOCAL_PREVIEW: '1',
  NEXT_PUBLIC_LOCAL_MEDIA: '1',
  CONTENT_TELEMETRY_FILE: resolve(root,'.data/paddock-preview/latency.json'),
  FLIGHT_SYNC_ENABLED: '0',
  MERAK_AUTO_MIGRATE: '0',
}
let child
let stopping = false
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{
  stopping = true
  child?.kill(signal)
})
async function run(args) {
  if (stopping) process.exit(0)
  await new Promise((resolve,reject)=>{
    child = spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'})
    child.on('error',reject)
    child.on('exit',(code,signal)=> code === 0 || stopping ? resolve() : reject(new Error(`预览命令退出：${code ?? signal}`)))
  })
}
try {
  console.log('正在构建本地数据预览…')
  await run(['node_modules/next/dist/bin/next','build','--webpack'])
  await run(['scripts/check-build.mjs'])
  if (!stopping) {
    console.log(`\n本机：http://127.0.0.1:${port}\n局域网：http://${address}:${port}\n按 Ctrl+C 停止。\n`)
    await run(['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',port])
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
