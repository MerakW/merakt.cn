import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['posts', 'notes', 'albums']) {
    await db.run(sql.raw(`ALTER TABLE "${table}" ADD "compound" text DEFAULT 'auto'`))
    await db.run(sql.raw(`ALTER TABLE "_${table}_v" ADD "version_compound" text DEFAULT 'auto'`))
  }
  await db.run(sql`ALTER TABLE site_settings ADD track_mode text DEFAULT 'auto'`)
  await db.run(sql`ALTER TABLE site_settings ADD forza_ferrari integer DEFAULT false`)
  await db.run(sql`ALTER TABLE _site_settings_v ADD version_track_mode text DEFAULT 'auto'`)
  await db.run(sql`ALTER TABLE _site_settings_v ADD version_forza_ferrari integer DEFAULT false`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const table of ['posts', 'notes', 'albums']) {
    await db.run(sql.raw(`ALTER TABLE "${table}" DROP COLUMN "compound"`))
    await db.run(sql.raw(`ALTER TABLE "_${table}_v" DROP COLUMN "version_compound"`))
  }
  await db.run(sql`ALTER TABLE site_settings DROP COLUMN track_mode`)
  await db.run(sql`ALTER TABLE site_settings DROP COLUMN forza_ferrari`)
  await db.run(sql`ALTER TABLE _site_settings_v DROP COLUMN version_track_mode`)
  await db.run(sql`ALTER TABLE _site_settings_v DROP COLUMN version_forza_ferrari`)
}
