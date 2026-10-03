"""Additive, repeatable SQLite migration; pass each database path explicitly."""
import sqlite3
import sys
for path in sys.argv[1:]:
    with sqlite3.connect(path) as db:
        with sqlite3.connect(path + '.before-schedule-privacy.bak') as backup:
            db.backup(backup)
        for table, column in [('flights', 'hide_schedule'), ('_flights_v', 'version_hide_schedule')]:
            columns = {row[1] for row in db.execute(f'PRAGMA table_info("{table}")')}
            if not columns:
                raise RuntimeError(f'Missing table: {table}')
            if column not in columns:
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" integer DEFAULT 0')
        print(f'Migrated: {path}')
