import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE flight_provider_queries (
    id integer PRIMARY KEY NOT NULL, key text NOT NULL UNIQUE, flight_number text NOT NULL, date text NOT NULL,
    status text NOT NULL, cost_fen numeric NOT NULL, requested_by numeric NOT NULL,
    flights text, error_code text, started_at text, lease_token text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(sql`CREATE INDEX flight_provider_queries_flight_number_idx ON flight_provider_queries(flight_number);`)
  await db.run(sql`CREATE INDEX flight_provider_queries_date_idx ON flight_provider_queries(date);`)
  await db.run(sql`CREATE INDEX flight_provider_queries_status_idx ON flight_provider_queries(status);`)
  await db.run(sql`CREATE INDEX flight_provider_queries_updated_at_idx ON flight_provider_queries(updated_at);`)
  await db.run(sql`CREATE INDEX flight_provider_queries_created_at_idx ON flight_provider_queries(created_at);`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> { await db.run(sql`DROP TABLE flight_provider_queries;`) }
