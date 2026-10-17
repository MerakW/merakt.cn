import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE notes ADD team_reply text`)
  await db.run(sql`ALTER TABLE _notes_v ADD version_team_reply text`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE notes DROP COLUMN team_reply`)
  await db.run(sql`ALTER TABLE _notes_v DROP COLUMN version_team_reply`)
}
