import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/** Pit Lane applicants can ask for email updates (receipt + review result) at their contact email. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`friends\` ADD \`notify\` integer DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`friends\` DROP COLUMN \`notify\`;`)
}
