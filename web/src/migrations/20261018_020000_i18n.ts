import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// Additive optional fields preserve every Chinese record and its draft history.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE "albums" ADD COLUMN "title_en" text;`)
  await db.run(sql`ALTER TABLE "albums" ADD COLUMN "description_en" text;`)
  await db.run(sql`ALTER TABLE "albums_photos" ADD COLUMN "caption_en" text;`)
  await db.run(sql`ALTER TABLE "posts" ADD COLUMN "title_en" text;`)
  await db.run(sql`ALTER TABLE "posts" ADD COLUMN "excerpt_en" text;`)
  await db.run(sql`ALTER TABLE "posts" ADD COLUMN "body_en" text;`)
  await db.run(sql`ALTER TABLE "notes" ADD COLUMN "text_en" text;`)
  await db.run(sql`ALTER TABLE "notes_radio_messages" ADD COLUMN "message_en" text;`)
  await db.run(sql`ALTER TABLE "media" ADD COLUMN "alt_en" text;`)
  await db.run(sql`ALTER TABLE "_albums_v" ADD COLUMN "version_title_en" text;`)
  await db.run(sql`ALTER TABLE "_albums_v" ADD COLUMN "version_description_en" text;`)
  await db.run(sql`ALTER TABLE "_albums_v_version_photos" ADD COLUMN "caption_en" text;`)
  await db.run(sql`ALTER TABLE "_posts_v" ADD COLUMN "version_title_en" text;`)
  await db.run(sql`ALTER TABLE "_posts_v" ADD COLUMN "version_excerpt_en" text;`)
  await db.run(sql`ALTER TABLE "_posts_v" ADD COLUMN "version_body_en" text;`)
  await db.run(sql`ALTER TABLE "_notes_v" ADD COLUMN "version_text_en" text;`)
  await db.run(sql`ALTER TABLE "_notes_v_version_radio_messages" ADD COLUMN "message_en" text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE "_notes_v_version_radio_messages" DROP COLUMN "message_en";`)
  await db.run(sql`ALTER TABLE "_notes_v" DROP COLUMN "version_text_en";`)
  await db.run(sql`ALTER TABLE "_posts_v" DROP COLUMN "version_body_en";`)
  await db.run(sql`ALTER TABLE "_posts_v" DROP COLUMN "version_excerpt_en";`)
  await db.run(sql`ALTER TABLE "_posts_v" DROP COLUMN "version_title_en";`)
  await db.run(sql`ALTER TABLE "_albums_v_version_photos" DROP COLUMN "caption_en";`)
  await db.run(sql`ALTER TABLE "_albums_v" DROP COLUMN "version_description_en";`)
  await db.run(sql`ALTER TABLE "_albums_v" DROP COLUMN "version_title_en";`)
  await db.run(sql`ALTER TABLE "media" DROP COLUMN "alt_en";`)
  await db.run(sql`ALTER TABLE "notes_radio_messages" DROP COLUMN "message_en";`)
  await db.run(sql`ALTER TABLE "notes" DROP COLUMN "text_en";`)
  await db.run(sql`ALTER TABLE "posts" DROP COLUMN "body_en";`)
  await db.run(sql`ALTER TABLE "posts" DROP COLUMN "excerpt_en";`)
  await db.run(sql`ALTER TABLE "posts" DROP COLUMN "title_en";`)
  await db.run(sql`ALTER TABLE "albums_photos" DROP COLUMN "caption_en";`)
  await db.run(sql`ALTER TABLE "albums" DROP COLUMN "description_en";`)
  await db.run(sql`ALTER TABLE "albums" DROP COLUMN "title_en";`)
}
