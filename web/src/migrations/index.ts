import * as migration_20261002_173728_initial_schema from './20261002_173728_initial_schema';
import * as migration_20261004_160409_passkeys from './20261004_160409_passkeys';

export const migrations = [
  {
    up: migration_20261002_173728_initial_schema.up,
    down: migration_20261002_173728_initial_schema.down,
    name: '20261002_173728_initial_schema',
  },
  {
    up: migration_20261004_160409_passkeys.up,
    down: migration_20261004_160409_passkeys.down,
    name: '20261004_160409_passkeys'
  },
];
