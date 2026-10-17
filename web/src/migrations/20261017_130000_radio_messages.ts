import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE "notes_radio_messages" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" text PRIMARY KEY NOT NULL, "speaker" text, "message" text, FOREIGN KEY ("_parent_id") REFERENCES "notes"("id") ON DELETE cascade ON UPDATE no action);`)
  await db.run(sql`CREATE INDEX "notes_radio_messages_order_idx" ON "notes_radio_messages" ("_order");`)
  await db.run(sql`CREATE INDEX "notes_radio_messages_parent_id_idx" ON "notes_radio_messages" ("_parent_id");`)
  await db.run(sql`INSERT INTO "notes_radio_messages" ("_order", "_parent_id", "speaker", "message", "id") SELECT 1, id, 'driver', "text", lower(hex(randomblob(12))) FROM "notes" WHERE length(trim(coalesce("text",''))) > 0;`)
  await db.run(sql`INSERT INTO "notes_radio_messages" ("_order", "_parent_id", "speaker", "message", "id") SELECT 2, id, 'team', "team_reply", lower(hex(randomblob(12))) FROM "notes" WHERE length(trim(coalesce("team_reply",''))) > 0;`)
  await db.run(sql`CREATE TABLE "_notes_v_version_radio_messages" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" integer PRIMARY KEY NOT NULL, "speaker" text, "message" text, "_uuid" text, FOREIGN KEY ("_parent_id") REFERENCES "_notes_v"("id") ON DELETE cascade ON UPDATE no action);`)
  await db.run(sql`CREATE INDEX "_notes_v_version_radio_messages_order_idx" ON "_notes_v_version_radio_messages" ("_order");`)
  await db.run(sql`CREATE INDEX "_notes_v_version_radio_messages_parent_id_idx" ON "_notes_v_version_radio_messages" ("_parent_id");`)
  await db.run(sql`INSERT INTO "_notes_v_version_radio_messages" ("_order", "_parent_id", "speaker", "message", "_uuid") SELECT 1, id, 'driver', "version_text", lower(hex(randomblob(12))) FROM "_notes_v" WHERE length(trim(coalesce("version_text",''))) > 0;`)
  await db.run(sql`INSERT INTO "_notes_v_version_radio_messages" ("_order", "_parent_id", "speaker", "message", "_uuid") SELECT 2, id, 'team', "version_team_reply", lower(hex(randomblob(12))) FROM "_notes_v" WHERE length(trim(coalesce("version_team_reply",''))) > 0;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE _notes_v_version_radio_messages`)
  await db.run(sql`DROP TABLE notes_radio_messages`)
}
