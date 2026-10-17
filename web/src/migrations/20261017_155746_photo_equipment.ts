import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_medium\` text DEFAULT 'digital';`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_camera\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_lens\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_focal_length\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`exposure_film_stock\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`exposure_medium\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`exposure_camera\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`exposure_lens\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`exposure_focal_length\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`exposure_film_stock\`;`)
}
