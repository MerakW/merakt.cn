import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/** Pit Lane: keep the outcome of the last logo fetch so a failing favicon can be diagnosed from the admin. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`friends\` ADD \`logo_status\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`friends\` DROP COLUMN \`logo_status\`;`)
}
