import { existsSync, mkdirSync, readFileSync, chmodSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

export function prepareRuntime(env, releaseDir) {
  if (!env.PAYLOAD_SECRET) throw new Error('请在 1Panel 设置固定的 PAYLOAD_SECRET，更新时不要更换。')
  if (env.PAYLOAD_DROP_DATABASE === 'true') throw new Error('生产启动禁止 PAYLOAD_DROP_DATABASE。')
  let dbPath
  if (env.DATABASE_URL) {
    if (!env.DATABASE_URL.startsWith('file:/') || env.DATABASE_URL.includes('?')) throw new Error('DATABASE_URL 必须为绝对 file:/ 路径。')
    dbPath = fileURLToPath(env.DATABASE_URL)
  } else {
    if (!env.MERAK_DATA_DIR || !isAbsolute(env.MERAK_DATA_DIR)) throw new Error('请设置绝对路径 MERAK_DATA_DIR，例如 /opt/merak/data。')
    dbPath = join(env.MERAK_DATA_DIR, 'merak.db')
  }
  const dataDir = dirname(dbPath)
  const mediaDir = env.MEDIA_DIR || join(dataDir, 'media')
  const backupDir = env.MERAK_BACKUP_DIR || join(dataDir, 'backups')
  for (const path of [dbPath, mediaDir, backupDir]) {
    if (!isAbsolute(path)) throw new Error('数据、媒体和备份必须使用绝对路径。')
    const relative = resolve(path)
    if (relative === resolve(releaseDir) || relative.startsWith(resolve(releaseDir) + '/')) throw new Error('数据目录不能在程序版本目录内；请使用独立持久化目录。')
  }
  const manifest = JSON.parse(readFileSync(join(releaseDir, 'release.json'), 'utf8'))
  if (!Array.isArray(manifest.migrations) || !manifest.migrations.length || !manifest.migrations.every(x => typeof x === 'string')) throw new Error('部署包缺少迁移清单。')
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  mkdirSync(mediaDir, { recursive: true, mode: 0o700 })
  let backup
  if (existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
      const hasHistory = tables.some(t => t.name === 'payload_migrations')
      const history = hasHistory ? db.prepare('SELECT name, batch FROM payload_migrations').all() : []
      if ((tables.length && !history.length) || history.some(m => m.batch < 0)) throw new Error('这是未建立生产迁移历史的旧库/开发库，已停止。请转换副本，不会重置原库。')
      if (history.some(m => !manifest.migrations.includes(m.name))) throw new Error('数据库比此程序版本新，禁止直接降级。请恢复配套数据库备份。')
      const pending = manifest.migrations.filter(name => !history.some(m => m.name === name))
      if (tables.length && pending.length) {
        mkdirSync(backupDir, { recursive: true, mode: 0o700 })
        backup = join(backupDir, `before-update-${Date.now()}.db`)
        // SQLite performs a consistent snapshot, including committed WAL data.
        db.prepare('VACUUM INTO ?').run(backup)
        chmodSync(backup, 0o600)
      }
    } finally { db.close() }
  }
  return { backup, env: { ...env, NODE_ENV: 'production', MERAK_AUTO_MIGRATE: '1', DATABASE_URL: pathToFileURL(dbPath).href, MEDIA_DIR: mediaDir } }
}
