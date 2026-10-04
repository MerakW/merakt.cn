import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`passkeys\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer NOT NULL,
  	\`credential_i_d\` text NOT NULL,
  	\`public_key\` text NOT NULL,
  	\`counter\` numeric NOT NULL,
  	\`transports\` text,
  	\`name\` text NOT NULL,
  	\`last_used_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`passkeys_user_idx\` ON \`passkeys\` (\`user_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`passkeys_credential_i_d_idx\` ON \`passkeys\` (\`credential_i_d\`);`)
  await db.run(sql`CREATE INDEX \`passkeys_updated_at_idx\` ON \`passkeys\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`passkeys_created_at_idx\` ON \`passkeys\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`passkey_challenges\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`token_hash\` text NOT NULL,
  	\`challenge\` text NOT NULL,
  	\`purpose\` text NOT NULL,
  	\`user_i_d\` numeric,
  	\`expires_at\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`passkey_challenges_token_hash_idx\` ON \`passkey_challenges\` (\`token_hash\`);`)
  await db.run(sql`CREATE INDEX \`passkey_challenges_expires_at_idx\` ON \`passkey_challenges\` (\`expires_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`passkeys\`;`)
  await db.run(sql`DROP TABLE \`passkey_challenges\`;`)
}
