import * as migration_20261002_173728_initial_schema from './20261002_173728_initial_schema';
import * as migration_20261004_160409_passkeys from './20261004_160409_passkeys';
import * as migration_20261012_120000_flight_runway_times from './20261012_120000_flight_runway_times';
import * as migration_20261012_121049_flight_sync_jobs from './20261012_121049_flight_sync_jobs';
import * as migration_20261012_123531_flight_aircraft_code from './20261012_123531_flight_aircraft_code';
import * as migration_20261013_040641_flight_worker_replays from './20261013_040641_flight_worker_replays';

export const migrations = [
  {
    up: migration_20261002_173728_initial_schema.up,
    down: migration_20261002_173728_initial_schema.down,
    name: '20261002_173728_initial_schema',
  },
  {
    up: migration_20261004_160409_passkeys.up,
    down: migration_20261004_160409_passkeys.down,
    name: '20261004_160409_passkeys',
  },
  {
    up: migration_20261012_120000_flight_runway_times.up,
    down: migration_20261012_120000_flight_runway_times.down,
    name: '20261012_120000_flight_runway_times',
  },
  {
    up: migration_20261012_121049_flight_sync_jobs.up,
    down: migration_20261012_121049_flight_sync_jobs.down,
    name: '20261012_121049_flight_sync_jobs',
  },
  {
    up: migration_20261012_123531_flight_aircraft_code.up,
    down: migration_20261012_123531_flight_aircraft_code.down,
    name: '20261012_123531_flight_aircraft_code',
  },
  {
    up: migration_20261013_040641_flight_worker_replays.up,
    down: migration_20261013_040641_flight_worker_replays.down,
    name: '20261013_040641_flight_worker_replays'
  },
];
