import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/** HGH APRON & PIT LANE: friend-link garages with health, tyre and logo telemetry. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`friends\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`tla\` text NOT NULL,
    \`name\` text NOT NULL,
    \`url\` text NOT NULL,
    \`team_color\` text DEFAULT '#2349ed' NOT NULL,
    \`bay\` numeric,
    \`bio\` text,
    \`cooling_msg\` text,
    \`logo_source\` text DEFAULT 'auto' NOT NULL,
    \`avatar_id\` integer,
    \`logo_id\` integer,
    \`tyre_mode\` text DEFAULT 'auto' NOT NULL,
    \`tyre\` text,
    \`bearing\` numeric,
    \`distance\` numeric,
    \`feed_url\` text,
    \`contact\` text,
    \`status\` text DEFAULT 'pending' NOT NULL,
    \`maintenance\` integer DEFAULT false,
    \`joined_at\` text,
    \`health_state\` text DEFAULT 'green',
    \`health_fail_streak\` numeric DEFAULT 0,
    \`health_ok_streak\` numeric DEFAULT 0,
    \`health_history\` text,
    \`health_latency_ms\` numeric,
    \`health_checked_at\` text,
    \`last_post_at\` text,
    \`feed_checked_at\` text,
    \`logo_checked_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`avatar_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`friends_tla_idx\` ON \`friends\` (\`tla\`);`)
  await db.run(sql`CREATE INDEX \`friends_avatar_idx\` ON \`friends\` (\`avatar_id\`);`)
  await db.run(sql`CREATE INDEX \`friends_logo_idx\` ON \`friends\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`friends_status_idx\` ON \`friends\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`friends_updated_at_idx\` ON \`friends\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`friends_created_at_idx\` ON \`friends\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`friends_id\` integer REFERENCES friends(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_friends_id_idx\` ON \`payload_locked_documents_rels\` (\`friends_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX payload_locked_documents_rels_friends_id_idx;`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN friends_id;`)
  await db.run(sql`DROP TABLE friends;`)
}
