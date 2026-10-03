import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { prepareRuntime } from '../scripts/prepare-runtime.mjs'

test('production preparation preserves data, snapshots pending migrations and rejects unsafe history', () => {
 const root=mkdtempSync(join(tmpdir(),'merak-runtime-'))
 try {
  const release=join(root,'release'), data=join(root,'data')
  mkdirSync(release)
  writeFileSync(join(release,'release.json'),JSON.stringify({migrations:['initial','next']}))
  const env={PAYLOAD_SECRET:'test-only-secret',MERAK_DATA_DIR:data}
  assert.equal(prepareRuntime(env,release).backup,undefined)
  assert.equal(existsSync(join(data,'media')),true)
  const db=new DatabaseSync(join(data,'merak.db'))
  db.exec("PRAGMA journal_mode=WAL;CREATE TABLE payload_migrations(name TEXT,batch INTEGER);INSERT INTO payload_migrations VALUES('initial',1);CREATE TABLE sentinel(value TEXT);INSERT INTO sentinel VALUES('keep me')")
  const result=prepareRuntime(env,release)
  assert.ok(result.backup)
  const backup=new DatabaseSync(result.backup,{readOnly:true})
  assert.equal(backup.prepare('SELECT value FROM sentinel').get()?.value,'keep me')
  backup.close()
  db.exec("INSERT INTO payload_migrations VALUES('next',2)")
  assert.equal(prepareRuntime(env,release).backup,undefined)
  db.exec("INSERT INTO payload_migrations VALUES('future',3)")
  assert.throws(()=>prepareRuntime(env,release),/禁止直接降级/)
  db.exec("DELETE FROM payload_migrations;INSERT INTO payload_migrations VALUES('dev',-1)")
  assert.throws(()=>prepareRuntime(env,release),/开发库/)
  assert.equal(db.prepare('SELECT value FROM sentinel').get()?.value,'keep me')
  db.close()
  assert.throws(()=>prepareRuntime({...env,MERAK_DATA_DIR:release},release),/独立持久化/)
 } finally {rmSync(root,{recursive:true,force:true})}
})
