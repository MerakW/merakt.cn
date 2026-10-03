import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`created_at\` text,
    \`expires_at\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`email\` text NOT NULL,
    \`reset_password_token\` text,
    \`reset_password_expiration\` text,
    \`salt\` text,
    \`hash\` text,
    \`reset_password_requested_at\` text,
    \`login_attempts\` numeric DEFAULT 0,
    \`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`alt\` text NOT NULL,
    \`credit\` text,
    \`source\` text,
    \`visibility\` text DEFAULT 'private' NOT NULL,
    \`legacy_path\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`url\` text,
    \`thumbnail_u_r_l\` text,
    \`filename\` text,
    \`mime_type\` text,
    \`filesize\` numeric,
    \`width\` numeric,
    \`height\` numeric,
    \`focal_x\` numeric,
    \`focal_y\` numeric,
    \`sizes_thumbnail_url\` text,
    \`sizes_thumbnail_width\` numeric,
    \`sizes_thumbnail_height\` numeric,
    \`sizes_thumbnail_mime_type\` text,
    \`sizes_thumbnail_filesize\` numeric,
    \`sizes_thumbnail_filename\` text,
    \`sizes_display_url\` text,
    \`sizes_display_width\` numeric,
    \`sizes_display_height\` numeric,
    \`sizes_display_mime_type\` text,
    \`sizes_display_filesize\` numeric,
    \`sizes_display_filename\` text
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`media_legacy_path_idx\` ON \`media\` (\`legacy_path\`);`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_thumbnail_sizes_thumbnail_filename_idx\` ON \`media\` (\`sizes_thumbnail_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_display_sizes_display_filename_idx\` ON \`media\` (\`sizes_display_filename\`);`)
  await db.run(sql`CREATE TABLE \`flights\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`date\` text,
    \`flight_number\` text,
    \`airline\` text,
    \`from\` text,
    \`to\` text,
    \`diverted_to\` text,
    \`state\` text DEFAULT 'unconfirmed',
    \`departure_local\` text,
    \`arrival_local\` text,
    \`departure_u_t_c\` text,
    \`arrival_u_t_c\` text,
    \`actual_departure_u_t_c\` text,
    \`actual_arrival_u_t_c\` text,
    \`departure_time_zone\` text,
    \`arrival_time_zone\` text,
    \`aircraft\` text,
    \`registration\` text,
    \`trip_id\` integer,
    \`note\` text,
    \`hide_schedule\` integer DEFAULT false,
    \`visibility\` text DEFAULT 'private',
    \`publish_at\` text,
    \`import_key\` text,
    \`source_id\` text,
    \`private_details\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft',
    FOREIGN KEY (\`trip_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`flights_trip_idx\` ON \`flights\` (\`trip_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`flights_import_key_idx\` ON \`flights\` (\`import_key\`);`)
  await db.run(sql`CREATE INDEX \`flights_updated_at_idx\` ON \`flights\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`flights_created_at_idx\` ON \`flights\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`flights__status_idx\` ON \`flights\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`flights_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`media_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`flights\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`flights_rels_order_idx\` ON \`flights_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`flights_rels_parent_idx\` ON \`flights_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`flights_rels_path_idx\` ON \`flights_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`flights_rels_media_id_idx\` ON \`flights_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_flights_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_date\` text,
    \`version_flight_number\` text,
    \`version_airline\` text,
    \`version_from\` text,
    \`version_to\` text,
    \`version_diverted_to\` text,
    \`version_state\` text DEFAULT 'unconfirmed',
    \`version_departure_local\` text,
    \`version_arrival_local\` text,
    \`version_departure_u_t_c\` text,
    \`version_arrival_u_t_c\` text,
    \`version_actual_departure_u_t_c\` text,
    \`version_actual_arrival_u_t_c\` text,
    \`version_departure_time_zone\` text,
    \`version_arrival_time_zone\` text,
    \`version_aircraft\` text,
    \`version_registration\` text,
    \`version_trip_id\` integer,
    \`version_note\` text,
    \`version_hide_schedule\` integer DEFAULT false,
    \`version_visibility\` text DEFAULT 'private',
    \`version_publish_at\` text,
    \`version_import_key\` text,
    \`version_source_id\` text,
    \`version_private_details\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`flights\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_trip_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_flights_v_parent_idx\` ON \`_flights_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_version_version_trip_idx\` ON \`_flights_v\` (\`version_trip_id\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_version_version_import_key_idx\` ON \`_flights_v\` (\`version_import_key\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_version_version_updated_at_idx\` ON \`_flights_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_version_version_created_at_idx\` ON \`_flights_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_version_version__status_idx\` ON \`_flights_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_created_at_idx\` ON \`_flights_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_updated_at_idx\` ON \`_flights_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_latest_idx\` ON \`_flights_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_autosave_idx\` ON \`_flights_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_flights_v_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`media_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`_flights_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_flights_v_rels_order_idx\` ON \`_flights_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_rels_parent_idx\` ON \`_flights_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_rels_path_idx\` ON \`_flights_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_flights_v_rels_media_id_idx\` ON \`_flights_v_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`trips\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text,
    \`slug\` text,
    \`description\` text,
    \`cover_id\` integer,
    \`visibility\` text DEFAULT 'private',
    \`publish_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft',
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`trips_slug_idx\` ON \`trips\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`trips_cover_idx\` ON \`trips\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`trips_updated_at_idx\` ON \`trips\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`trips_created_at_idx\` ON \`trips\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`trips__status_idx\` ON \`trips\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_trips_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text,
    \`version_slug\` text,
    \`version_description\` text,
    \`version_cover_id\` integer,
    \`version_visibility\` text DEFAULT 'private',
    \`version_publish_at\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_trips_v_parent_idx\` ON \`_trips_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_version_version_slug_idx\` ON \`_trips_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_version_version_cover_idx\` ON \`_trips_v\` (\`version_cover_id\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_version_version_updated_at_idx\` ON \`_trips_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_version_version_created_at_idx\` ON \`_trips_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_version_version__status_idx\` ON \`_trips_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_created_at_idx\` ON \`_trips_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_updated_at_idx\` ON \`_trips_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_latest_idx\` ON \`_trips_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_trips_v_autosave_idx\` ON \`_trips_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`albums_photos\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`image_id\` integer,
    \`caption\` text,
    \`credit\` text,
    \`source\` text,
    FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`albums_photos_order_idx\` ON \`albums_photos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`albums_photos_parent_id_idx\` ON \`albums_photos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`albums_photos_image_idx\` ON \`albums_photos\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`albums\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text,
    \`slug\` text,
    \`date\` text,
    \`description\` text,
    \`cover_id\` integer,
    \`photographer\` text,
    \`trip_id\` integer,
    \`legacy_id\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft',
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`trip_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`albums_slug_idx\` ON \`albums\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`albums_cover_idx\` ON \`albums\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`albums_trip_idx\` ON \`albums\` (\`trip_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`albums_legacy_id_idx\` ON \`albums\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`albums_updated_at_idx\` ON \`albums\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`albums_created_at_idx\` ON \`albums\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`albums__status_idx\` ON \`albums\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_albums_v_version_photos\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` integer PRIMARY KEY NOT NULL,
    \`image_id\` integer,
    \`caption\` text,
    \`credit\` text,
    \`source\` text,
    \`_uuid\` text,
    FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`_albums_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_albums_v_version_photos_order_idx\` ON \`_albums_v_version_photos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_photos_parent_id_idx\` ON \`_albums_v_version_photos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_photos_image_idx\` ON \`_albums_v_version_photos\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_albums_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text,
    \`version_slug\` text,
    \`version_date\` text,
    \`version_description\` text,
    \`version_cover_id\` integer,
    \`version_photographer\` text,
    \`version_trip_id\` integer,
    \`version_legacy_id\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_trip_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_albums_v_parent_idx\` ON \`_albums_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_slug_idx\` ON \`_albums_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_cover_idx\` ON \`_albums_v\` (\`version_cover_id\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_trip_idx\` ON \`_albums_v\` (\`version_trip_id\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_legacy_id_idx\` ON \`_albums_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_updated_at_idx\` ON \`_albums_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version_created_at_idx\` ON \`_albums_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_version_version__status_idx\` ON \`_albums_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_created_at_idx\` ON \`_albums_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_updated_at_idx\` ON \`_albums_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_latest_idx\` ON \`_albums_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_albums_v_autosave_idx\` ON \`_albums_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`posts\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text,
    \`slug\` text,
    \`date\` text,
    \`excerpt\` text,
    \`category\` text DEFAULT '生活',
    \`cover_id\` integer,
    \`body\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft',
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`posts_cover_idx\` ON \`posts\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`posts__status_idx\` ON \`posts\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`posts_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`trips_id\` integer,
    \`albums_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`trips_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`albums_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_trips_id_idx\` ON \`posts_rels\` (\`trips_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_albums_id_idx\` ON \`posts_rels\` (\`albums_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text,
    \`version_slug\` text,
    \`version_date\` text,
    \`version_excerpt\` text,
    \`version_category\` text DEFAULT '生活',
    \`version_cover_id\` integer,
    \`version_body\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_slug_idx\` ON \`_posts_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_cover_idx\` ON \`_posts_v\` (\`version_cover_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_updated_at_idx\` ON \`_posts_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_created_at_idx\` ON \`_posts_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version__status_idx\` ON \`_posts_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_autosave_idx\` ON \`_posts_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`trips_id\` integer,
    \`albums_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`trips_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`albums_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_order_idx\` ON \`_posts_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_parent_idx\` ON \`_posts_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_path_idx\` ON \`_posts_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_trips_id_idx\` ON \`_posts_v_rels\` (\`trips_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_albums_id_idx\` ON \`_posts_v_rels\` (\`albums_id\`);`)
  await db.run(sql`CREATE TABLE \`notes\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`text\` text,
    \`image_id\` integer,
    \`link\` text,
    \`date\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft',
    FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`notes_image_idx\` ON \`notes\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`notes_updated_at_idx\` ON \`notes\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`notes_created_at_idx\` ON \`notes\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`notes__status_idx\` ON \`notes\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_notes_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_text\` text,
    \`version_image_id\` integer,
    \`version_link\` text,
    \`version_date\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`notes\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_notes_v_parent_idx\` ON \`_notes_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_version_version_image_idx\` ON \`_notes_v\` (\`version_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_version_version_updated_at_idx\` ON \`_notes_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_version_version_created_at_idx\` ON \`_notes_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_version_version__status_idx\` ON \`_notes_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_created_at_idx\` ON \`_notes_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_updated_at_idx\` ON \`_notes_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_latest_idx\` ON \`_notes_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_notes_v_autosave_idx\` ON \`_notes_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`events\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text,
    \`slug\` text,
    \`start\` text,
    \`end\` text,
    \`time_zone\` text DEFAULT 'Asia/Shanghai',
    \`location\` text,
    \`description\` text,
    \`cancelled\` integer DEFAULT false,
    \`url\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`events_slug_idx\` ON \`events\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`events_updated_at_idx\` ON \`events\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`events_created_at_idx\` ON \`events\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`events__status_idx\` ON \`events\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_events_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`parent_id\` integer,
    \`version_title\` text,
    \`version_slug\` text,
    \`version_start\` text,
    \`version_end\` text,
    \`version_time_zone\` text DEFAULT 'Asia/Shanghai',
    \`version_location\` text,
    \`version_description\` text,
    \`version_cancelled\` integer DEFAULT false,
    \`version_url\` text,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`version__status\` text DEFAULT 'draft',
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`latest\` integer,
    \`autosave\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`events\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_events_v_parent_idx\` ON \`_events_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_version_version_slug_idx\` ON \`_events_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_version_version_updated_at_idx\` ON \`_events_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_version_version_created_at_idx\` ON \`_events_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_version_version__status_idx\` ON \`_events_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_created_at_idx\` ON \`_events_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_updated_at_idx\` ON \`_events_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_latest_idx\` ON \`_events_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_autosave_idx\` ON \`_events_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`checkins\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`message\` text NOT NULL,
    \`status\` text DEFAULT 'pending' NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`checkins_updated_at_idx\` ON \`checkins\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`checkins_created_at_idx\` ON \`checkins\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`global_slug\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`users_id\` integer,
    \`media_id\` integer,
    \`flights_id\` integer,
    \`trips_id\` integer,
    \`albums_id\` integer,
    \`posts_id\` integer,
    \`notes_id\` integer,
    \`events_id\` integer,
    \`checkins_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`flights_id\`) REFERENCES \`flights\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`trips_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`albums_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`notes_id\`) REFERENCES \`notes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`events_id\`) REFERENCES \`events\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`checkins_id\`) REFERENCES \`checkins\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_flights_id_idx\` ON \`payload_locked_documents_rels\` (\`flights_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_trips_id_idx\` ON \`payload_locked_documents_rels\` (\`trips_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_albums_id_idx\` ON \`payload_locked_documents_rels\` (\`albums_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_notes_id_idx\` ON \`payload_locked_documents_rels\` (\`notes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_events_id_idx\` ON \`payload_locked_documents_rels\` (\`events_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_checkins_id_idx\` ON \`payload_locked_documents_rels\` (\`checkins_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`key\` text,
    \`value\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`users_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text,
    \`batch\` numeric,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text DEFAULT 'Merak · 数字围场',
    \`intro\` text DEFAULT '住在杭州，喜欢航空、F1 和 Furry。平时会折腾智能家居，也经常给自己挖点新坑。',
    \`hero_image_id\` integer,
    \`featured_album_id\` integer,
    \`show_astronix\` integer DEFAULT false,
    \`show_airways\` integer DEFAULT false,
    \`updated_at\` text,
    \`created_at\` text,
    FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`featured_album_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_hero_image_idx\` ON \`site_settings\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_featured_album_idx\` ON \`site_settings\` (\`featured_album_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`posts_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_rels_order_idx\` ON \`site_settings_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_parent_idx\` ON \`site_settings_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_path_idx\` ON \`site_settings_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_posts_id_idx\` ON \`site_settings_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`version_title\` text DEFAULT 'Merak · 数字围场',
    \`version_intro\` text DEFAULT '住在杭州，喜欢航空、F1 和 Furry。平时会折腾智能家居，也经常给自己挖点新坑。',
    \`version_hero_image_id\` integer,
    \`version_featured_album_id\` integer,
    \`version_show_astronix\` integer DEFAULT false,
    \`version_show_airways\` integer DEFAULT false,
    \`version_updated_at\` text,
    \`version_created_at\` text,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`version_featured_album_id\`) REFERENCES \`albums\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_site_settings_v_version_version_hero_image_idx\` ON \`_site_settings_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_version_version_featured_album_idx\` ON \`_site_settings_v\` (\`version_featured_album_id\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_created_at_idx\` ON \`_site_settings_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_updated_at_idx\` ON \`_site_settings_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`posts_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`_site_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_order_idx\` ON \`_site_settings_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_parent_idx\` ON \`_site_settings_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_path_idx\` ON \`_site_settings_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_posts_id_idx\` ON \`_site_settings_v_rels\` (\`posts_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`flights\`;`)
  await db.run(sql`DROP TABLE \`flights_rels\`;`)
  await db.run(sql`DROP TABLE \`_flights_v\`;`)
  await db.run(sql`DROP TABLE \`_flights_v_rels\`;`)
  await db.run(sql`DROP TABLE \`trips\`;`)
  await db.run(sql`DROP TABLE \`_trips_v\`;`)
  await db.run(sql`DROP TABLE \`albums_photos\`;`)
  await db.run(sql`DROP TABLE \`albums\`;`)
  await db.run(sql`DROP TABLE \`_albums_v_version_photos\`;`)
  await db.run(sql`DROP TABLE \`_albums_v\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`DROP TABLE \`_posts_v\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_rels\`;`)
  await db.run(sql`DROP TABLE \`notes\`;`)
  await db.run(sql`DROP TABLE \`_notes_v\`;`)
  await db.run(sql`DROP TABLE \`events\`;`)
  await db.run(sql`DROP TABLE \`_events_v\`;`)
  await db.run(sql`DROP TABLE \`checkins\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`site_settings_rels\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v_rels\`;`)
}
