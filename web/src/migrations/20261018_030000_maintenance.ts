import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE "site_settings" ADD COLUMN "maintenance_expected_exit" text;`)
  await db.run(sql`ALTER TABLE "site_settings" ADD COLUMN "maintenance_started_at" text;`)
  await db.run(sql`ALTER TABLE "_site_settings_v" ADD COLUMN "version_maintenance_expected_exit" text;`)
  await db.run(sql`ALTER TABLE "_site_settings_v" ADD COLUMN "version_maintenance_started_at" text;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE "_site_settings_v" DROP COLUMN "version_maintenance_started_at";`)
  await db.run(sql`ALTER TABLE "_site_settings_v" DROP COLUMN "version_maintenance_expected_exit";`)
  await db.run(sql`ALTER TABLE "site_settings" DROP COLUMN "maintenance_started_at";`)
  await db.run(sql`ALTER TABLE "site_settings" DROP COLUMN "maintenance_expected_exit";`)
}
