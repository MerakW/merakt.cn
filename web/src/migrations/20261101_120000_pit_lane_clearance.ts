import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/** Pit Lane clearance channels: application source, status ticket and reciprocal-link check. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`friends\` ADD \`backlink_url\` text;`)
  await db.run(sql`ALTER TABLE \`friends\` ADD \`source\` text DEFAULT 'admin';`)
  await db.run(sql`ALTER TABLE \`friends\` ADD \`backlink_at\` text;`)
  await db.run(sql`ALTER TABLE \`friends\` ADD \`ticket_hash\` text;`)
  await db.run(sql`ALTER TABLE \`friends\` ADD \`backlink_checked_at\` text;`)
  await db.run(sql`CREATE INDEX \`friends_ticket_hash_idx\` ON \`friends\` (\`ticket_hash\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`friends_ticket_hash_idx\`;`)
  for (const column of ['backlink_checked_at', 'ticket_hash', 'backlink_at', 'source', 'backlink_url']) await db.run(sql.raw(`ALTER TABLE \`friends\` DROP COLUMN \`${column}\`;`))
}
