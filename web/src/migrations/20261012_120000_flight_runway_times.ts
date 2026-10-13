import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE flights ADD COLUMN takeoff_u_t_c text;`)
  await db.run(sql`ALTER TABLE flights ADD COLUMN touchdown_u_t_c text;`)
  await db.run(sql`ALTER TABLE _flights_v ADD COLUMN version_takeoff_u_t_c text;`)
  await db.run(sql`ALTER TABLE _flights_v ADD COLUMN version_touchdown_u_t_c text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE _flights_v DROP COLUMN version_touchdown_u_t_c;`)
  await db.run(sql`ALTER TABLE _flights_v DROP COLUMN version_takeoff_u_t_c;`)
  await db.run(sql`ALTER TABLE flights DROP COLUMN touchdown_u_t_c;`)
  await db.run(sql`ALTER TABLE flights DROP COLUMN takeoff_u_t_c;`)
}
