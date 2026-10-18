import * as maintenance from './20261018_030000_maintenance';
import * as migration_20261018_020000_i18n from './20261018_020000_i18n';
import * as migration_20261002_173728_initial_schema from './20261002_173728_initial_schema';
import * as migration_20261004_160409_passkeys from './20261004_160409_passkeys';
import * as migration_20261012_120000_flight_runway_times from './20261012_120000_flight_runway_times';
import * as migration_20261012_121049_flight_sync_jobs from './20261012_121049_flight_sync_jobs';
import * as migration_20261012_123531_flight_aircraft_code from './20261012_123531_flight_aircraft_code';
import * as migration_20261013_040641_flight_worker_replays from './20261013_040641_flight_worker_replays';
import * as migration_20261016_160000_paddock from './20261016_160000_paddock';
import * as migration_20261017_120000_team_radio_reply from './20261017_120000_team_radio_reply';
import * as migration_20261017_130000_radio_messages from './20261017_130000_radio_messages';
import * as migration_20261017_152556_paddock_interactions from './20261017_152556_paddock_interactions';
import * as migration_20261017_155746_photo_equipment from './20261017_155746_photo_equipment';

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
    name: '20261013_040641_flight_worker_replays',
  },
  {
    up: migration_20261016_160000_paddock.up,
    down: migration_20261016_160000_paddock.down,
    name: '20261016_160000_paddock',
  },
  {
    up: migration_20261017_120000_team_radio_reply.up,
    down: migration_20261017_120000_team_radio_reply.down,
    name: '20261017_120000_team_radio_reply',
  },
  {
    up: migration_20261017_130000_radio_messages.up,
    down: migration_20261017_130000_radio_messages.down,
    name: '20261017_130000_radio_messages',
  },
  {
    up: migration_20261017_152556_paddock_interactions.up,
    down: migration_20261017_152556_paddock_interactions.down,
    name: '20261017_152556_paddock_interactions',
  },
  {
    up: migration_20261017_155746_photo_equipment.up,
    down: migration_20261017_155746_photo_equipment.down,
    name: '20261017_155746_photo_equipment'
  },
  { up: migration_20261018_020000_i18n.up, down: migration_20261018_020000_i18n.down, name: '20261018_020000_i18n' },
  { up: maintenance.up, down: maintenance.down, name: '20261018_030000_maintenance' },
];
