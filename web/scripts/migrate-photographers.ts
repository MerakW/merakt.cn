import { existsSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import { up, backfillPhotographers } from '../src/migrations/20261114_120000_photographers'
if (existsSync('.env')) process.loadEnvFile('.env')
const client = createClient({ url: process.env.DATABASE_URL || 'file:./.data/merak.db' })
try {
  await drizzle(client).transaction(async transaction => {
    const db = transaction as unknown as MigrateUpArgs['db']
    const migrated = await db.all(sql`SELECT id FROM payload_migrations WHERE name = '20261114_120000_photographers'`)
    if (migrated.length) console.log('Photographer migration already recorded.')
    else {
      const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'photographers'`)
      if (tables.length) await backfillPhotographers({ db } as Pick<MigrateUpArgs, 'db'>)
      else await up({ db } as unknown as MigrateUpArgs)
      await db.run(sql`INSERT INTO payload_migrations (name, batch, updated_at, created_at) VALUES ('20261114_120000_photographers', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      console.log('Photographer IDs and historical album references migrated.')
    }
  }, { behavior: 'immediate' })
} finally { client.close() }
