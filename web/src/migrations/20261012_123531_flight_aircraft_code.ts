import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`flights\` ADD \`aircraft_code\` text;`)
  await db.run(sql`ALTER TABLE \`_flights_v\` ADD \`version_aircraft_code\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`flights\` DROP COLUMN \`aircraft_code\`;`)
  await db.run(sql`ALTER TABLE \`_flights_v\` DROP COLUMN \`version_aircraft_code\`;`)
}
