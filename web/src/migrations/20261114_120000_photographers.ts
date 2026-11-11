import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
import { creditsOf, personKey } from '../lib/gallery'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw("CREATE TABLE `photographers` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`is_self` integer DEFAULT false,\n\t`url` text,\n\t`aliases` text,\n\t`key` text NOT NULL,\n\t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n\t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL\n)"))
  await db.run(sql.raw("CREATE UNIQUE INDEX `photographers_key_idx` ON `photographers` (`key`)"))
  await db.run(sql.raw("CREATE INDEX `photographers_updated_at_idx` ON `photographers` (`updated_at`)"))
  await db.run(sql.raw("CREATE INDEX `photographers_created_at_idx` ON `photographers` (`created_at`)"))
  await db.run(sql.raw("CREATE TABLE `albums_rels` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`order` integer,\n\t`parent_id` integer NOT NULL,\n\t`path` text NOT NULL,\n\t`photographers_id` integer,\n\tFOREIGN KEY (`parent_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`photographers_id`) REFERENCES `photographers`(`id`) ON UPDATE no action ON DELETE cascade\n)"))
  await db.run(sql.raw("CREATE INDEX `albums_rels_order_idx` ON `albums_rels` (`order`)"))
  await db.run(sql.raw("CREATE INDEX `albums_rels_parent_idx` ON `albums_rels` (`parent_id`)"))
  await db.run(sql.raw("CREATE INDEX `albums_rels_path_idx` ON `albums_rels` (`path`)"))
  await db.run(sql.raw("CREATE INDEX `albums_rels_photographers_id_idx` ON `albums_rels` (`photographers_id`)"))
  await db.run(sql.raw("CREATE TABLE `_albums_v_rels` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`order` integer,\n\t`parent_id` integer NOT NULL,\n\t`path` text NOT NULL,\n\t`photographers_id` integer,\n\tFOREIGN KEY (`parent_id`) REFERENCES `_albums_v`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`photographers_id`) REFERENCES `photographers`(`id`) ON UPDATE no action ON DELETE cascade\n)"))
  await db.run(sql.raw("CREATE INDEX `_albums_v_rels_order_idx` ON `_albums_v_rels` (`order`)"))
  await db.run(sql.raw("CREATE INDEX `_albums_v_rels_parent_idx` ON `_albums_v_rels` (`parent_id`)"))
  await db.run(sql.raw("CREATE INDEX `_albums_v_rels_path_idx` ON `_albums_v_rels` (`path`)"))
  await db.run(sql.raw("CREATE INDEX `_albums_v_rels_photographers_id_idx` ON `_albums_v_rels` (`photographers_id`)"))
  await db.run(sql.raw("ALTER TABLE payload_locked_documents_rels ADD COLUMN photographers_id integer REFERENCES photographers(id) ON DELETE cascade"))
  await db.run(sql.raw("CREATE INDEX payload_locked_documents_rels_photographers_id_idx ON payload_locked_documents_rels (photographers_id)"))
  await backfillPhotographers({ db })
}

export async function backfillPhotographers({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  const link = async (table: string, parent: number, path: string, text: string, credit?: string | null) => {
    const line = creditsOf(text || '', credit).find(line => line.role === 'photo')
    const names = [...(line?.names || []), ...(line?.me ? ['Merak'] : [])]
    let order = 0
    for (const name of names) {
      const key = personKey(name).toLowerCase()
      await db.run(sql`INSERT INTO photographers (name, key, aliases, is_self) VALUES (${personKey(name)}, ${key}, ${name}, ${key === 'merak' ? 1 : 0}) ON CONFLICT(key) DO NOTHING`)
      const rows = await db.all<{ id: number }>(sql`SELECT id FROM photographers WHERE key = ${key}`)
      await db.run(sql`INSERT INTO ${sql.identifier(table)} ("order", parent_id, path, photographers_id) SELECT ${++order}, ${parent}, ${path}, ${rows[0].id} WHERE NOT EXISTS (SELECT 1 FROM ${sql.identifier(table)} WHERE parent_id = ${parent} AND path = ${path} AND photographers_id = ${rows[0].id})`)
    }
    return names.length
  }
  for (const version of [false, true]) {
    const table = version ? '_albums_v' : 'albums', rels = version ? '_albums_v_rels' : 'albums_rels', prefix = version ? 'version_' : '', path = version ? 'version.' : ''
    const albums = await db.all<Record<string, unknown>>(sql`SELECT * FROM ${sql.identifier(table)}`)
    for (const album of albums) {
      const cover = album[prefix + 'cover_id'] ? await db.all<{ credit: string }>(sql`SELECT credit FROM media WHERE id = ${Number(album[prefix + 'cover_id'])}`) : []
      await link(rels, Number(album.id), path + 'photographers', String(album[prefix + 'description'] || ''), String(album[prefix + 'photographer'] || (creditsOf(String(album[prefix + 'description'] || '')).some(line => line.role === 'photo') ? '' : cover[0]?.credit) || ''))
      const photos = await db.all<{ _order: number; caption: string; credit: string; media_credit: string }>(sql`SELECT p.*, m.credit AS media_credit FROM ${sql.identifier(version ? '_albums_v_version_photos' : 'albums_photos')} p LEFT JOIN media m ON m.id = p.image_id WHERE p._parent_id = ${Number(album.id)}`)
      for (const photo of photos) await link(rels, Number(album.id), `${path}photos.${photo._order - 1}.photographers`, photo.caption, photo.credit || String(album[prefix + 'photographer'] || '') || (creditsOf(photo.caption).some(line => line.role === 'photo') ? undefined : photo.media_credit))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX payload_locked_documents_rels_photographers_id_idx`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN photographers_id`)
  await db.run(sql`DROP TABLE albums_rels`)
  await db.run(sql`DROP TABLE _albums_v_rels`)
  await db.run(sql`DROP TABLE photographers`)
}
