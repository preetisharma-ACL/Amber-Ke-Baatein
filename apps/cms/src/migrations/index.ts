import * as migration_20260807_070543_add_identity_global from './20260807_070543_add_identity_global';

export const migrations = [
  {
    up: migration_20260807_070543_add_identity_global.up,
    down: migration_20260807_070543_add_identity_global.down,
    name: '20260807_070543_add_identity_global'
  },
];
