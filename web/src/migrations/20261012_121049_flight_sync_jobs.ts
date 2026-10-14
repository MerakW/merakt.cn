import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`flight_sync_jobs\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`flight_number\` text NOT NULL,
    \`flight_id\` integer,
    \`phase\` text DEFAULT 'Awaiting_Radar' NOT NULL,
    \`request\` text NOT NULL,
    \`calibration_run_at\` text,
    \`next_run_at\` text,
    \`attempts\` numeric DEFAULT 0,
    \`calibration_attempts\` numeric DEFAULT 0,
    \`last_error\` text,
    \`evidence\` text,
    \`lease_until\` text,
    \`lease_token\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`flight_id\`) REFERENCES \`flights\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`flight_sync_jobs_key_idx\` ON \`flight_sync_jobs\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`flight_sync_jobs_flight_idx\` ON \`flight_sync_jobs\` (\`flight_id\`);`)
  await db.run(sql`CREATE INDEX \`flight_sync_jobs_phase_idx\` ON \`flight_sync_jobs\` (\`phase\`);`)
  await db.run(sql`CREATE INDEX \`flight_sync_jobs_next_run_at_idx\` ON \`flight_sync_jobs\` (\`next_run_at\`);`)
  await db.run(sql`CREATE INDEX \`flight_sync_jobs_updated_at_idx\` ON \`flight_sync_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`flight_sync_jobs_created_at_idx\` ON \`flight_sync_jobs\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`flight_sync_jobs\`;`)
}
