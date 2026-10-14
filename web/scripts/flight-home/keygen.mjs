import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'

mkdirSync('keys', { recursive: true, mode: 0o700 })
mkdirSync('secrets', { recursive: true, mode: 0o700 })
if (existsSync('keys/worker-private.pem') || existsSync('keys/worker-public.pem')) throw new Error('密钥已存在，保留现有文件。')
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
writeFileSync('keys/worker-private.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 })
writeFileSync('keys/worker-public.pem', publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx', mode: 0o644 })
console.log('密钥已生成。只向云端复制 keys/worker-public.pem。')
