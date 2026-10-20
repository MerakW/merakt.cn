import { build } from 'esbuild'
import { mkdir, copyFile, rm, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

// Bundle the existing provider and parser, rather than maintaining a second implementation.
const directory = resolve('.data/flight-logger-home')
try { await access(directory + '/keys'); throw new Error('部署包目录中已有密钥，请将实际部署目录与打包目录分开。') } catch (error) { if (error.code !== 'ENOENT') throw error }
await rm(directory, { recursive: true, force: true })
await mkdir(directory, { recursive: true })
await build({ entryPoints: ['scripts/flight-worker.ts'], outfile: directory + '/worker.mjs', bundle: true, platform: 'node', target: 'node22', format: 'esm', tsconfig: 'tsconfig.json' })
for (const name of ['Dockerfile', '.dockerignore', 'compose.yaml', 'compose.host-network.yaml', '.env.example', 'keygen.mjs']) await copyFile('scripts/flight-home/' + name, directory + '/' + name)
await copyFile('scripts/flight-sync-requirements.txt', directory + '/requirements.txt')
await copyFile('src/lib/flights/fr24_fetch.py', directory + '/fr24_fetch.py')
await copyFile('src/lib/flights/variflight_fetch.py', directory + '/variflight_fetch.py')
const archive = resolve('.data/flight-logger-home.tar.gz')
execFileSync('tar', ['-czf', archive, '-C', directory, '.'])
console.log('家庭端部署包：' + archive)
