import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/** Pit Lane garage: optional self-service accounts for friends, opened after approval. */
const COLUMNS = [
  ['account_email', 'text'], ['login_enabled', 'integer DEFAULT false'], ['password_set_at', 'text'], ['last_login_at', 'text'], ['password_hash', 'text'],
  ['session_version', 'numeric DEFAULT 0'], ['reset_token_hash', 'text'], ['reset_expires', 'text'], ['login_failures', 'numeric DEFAULT 0'], ['locked_until', 'text'],
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [name, type] of COLUMNS) await db.run(sql.raw(`ALTER TABLE \`friends\` ADD \`${name}\` ${type};`))
  await db.run(sql`CREATE UNIQUE INDEX \`friends_account_email_idx\` ON \`friends\` (\`account_email\`);`)
  await db.run(sql`CREATE INDEX \`friends_reset_token_hash_idx\` ON \`friends\` (\`reset_token_hash\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`friends_reset_token_hash_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`friends_account_email_idx\`;`)
  for (const [name] of [...COLUMNS].reverse()) await db.run(sql.raw(`ALTER TABLE \`friends\` DROP COLUMN \`${name}\`;`))
}
