import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`flight_worker_replays\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`nonce\` text NOT NULL,
    \`expires_at\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`flight_worker_replays_nonce_idx\` ON \`flight_worker_replays\` (\`nonce\`);`)
  await db.run(sql`CREATE INDEX \`flight_worker_replays_expires_at_idx\` ON \`flight_worker_replays\` (\`expires_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`flight_worker_replays\`;`)
}
