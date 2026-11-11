import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import { migrations } from '../src/migrations'
import { up, down } from '../src/migrations/20261114_120000_photographers'
const directory = await mkdtemp(join(tmpdir(), 'merak-photographers-migration-'))
const client = createClient({ url: 'file:' + join(directory, 'test.db') })
const db = drizzle(client)
const args = { db } as unknown as MigrateUpArgs
try {
  for (const migration of migrations.filter(migration => migration.name < '20261114')) await migration.up(args)
  await db.run(sql`INSERT INTO media (id, alt, credit, visibility, updated_at, created_at) VALUES (1, 'Fixture', '@MediaOnly', 'public', '2026-11-12', '2026-11-12')`)
  await db.run(sql`INSERT INTO albums (id, title, slug, description, photographer, cover_id, updated_at, created_at, _status) VALUES (1, 'Fixture', 'fixture', '📷 @FurryPorridge', NULL, 1, '2026-11-12', '2026-11-12', 'published')`)
  await db.run(sql`INSERT INTO albums_photos (_order, _parent_id, id, image_id, caption) VALUES (1, 1, 'a', 1, '📷 我'), (2, 1, 'b', 1, 'No credit')`)
  await db.run(sql`INSERT INTO _albums_v (id, parent_id, version_title, version_slug, version_description, version_cover_id, version_updated_at, version_created_at) VALUES (1, 1, 'Fixture', 'fixture', '📷 @稀饭', 1, '2026-11-12', '2026-11-12')`)
  await db.run(sql`INSERT INTO _albums_v_version_photos (_order, _parent_id, image_id, caption) VALUES (1, 1, 1, '📷 @稀饭')`)
  await up(args)
  const people = await db.all<{ id: number; name: string; is_self: number }>(sql`SELECT id, name, is_self FROM photographers ORDER BY id`)
  assert.deepEqual(people.map(person => person.name).sort(), ['MediaOnly', 'Merak', '熙帆'].sort())
  assert.equal(people.find(person => person.name === 'Merak')?.is_self, 1)
  const links = await db.all<{ path: string; name: string }>(sql`SELECT r.path, p.name FROM albums_rels r JOIN photographers p ON p.id = r.photographers_id ORDER BY r.path`)
  assert.deepEqual(links, [{ path: 'photographers', name: '熙帆' }, { path: 'photos.0.photographers', name: 'Merak' }, { path: 'photos.1.photographers', name: 'MediaOnly' }])
  const versions = await db.all<{ name: string }>(sql`SELECT p.name FROM _albums_v_rels r JOIN photographers p ON p.id = r.photographers_id`)
  assert.deepEqual(versions.map(row => row.name), ['熙帆', '熙帆'])
  await down(args)
  assert.equal((await db.all(sql`SELECT * FROM albums`)).length, 1)
  await up(args)
  assert.equal((await db.all(sql`SELECT * FROM photographers`)).length, 3)
  console.log('PASS: production schema upgrades populated legacy albums/photos/versions, canonical aliases, media fallback, self identity, rollback and reapply preserve original content')
} finally { client.close() }
