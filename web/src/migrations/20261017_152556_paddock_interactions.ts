import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`paddock_signals\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`kind\` text NOT NULL,
    \`name\` text,
    \`approved\` integer DEFAULT false,
    \`value\` numeric,
    \`subject\` text,
    \`ticket\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`paddock_signals_kind_idx\` ON \`paddock_signals\` (\`kind\`);`)
  await db.run(sql`CREATE INDEX \`paddock_signals_subject_idx\` ON \`paddock_signals\` (\`subject\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`paddock_signals_ticket_idx\` ON \`paddock_signals\` (\`ticket\`);`)
  await db.run(sql`CREATE INDEX \`paddock_signals_updated_at_idx\` ON \`paddock_signals\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`paddock_signals_created_at_idx\` ON \`paddock_signals\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_shutter\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_aperture\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_iso\` numeric;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`paddock_signals_id\` integer REFERENCES paddock_signals(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_paddock_signals_id_idx\` ON \`payload_locked_documents_rels\` (\`paddock_signals_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX payload_locked_documents_rels_paddock_signals_id_idx;`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN paddock_signals_id;`)
  await db.run(sql`DROP TABLE paddock_signals;`)
  await db.run(sql`ALTER TABLE media DROP COLUMN exposure_shutter;`)
  await db.run(sql`ALTER TABLE media DROP COLUMN exposure_aperture;`)
  await db.run(sql`ALTER TABLE media DROP COLUMN exposure_iso;`)
}
