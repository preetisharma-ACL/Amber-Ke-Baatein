import * as migration_20260807_070543_add_identity_global from './20260807_070543_add_identity_global';
import * as migration_20260811_112125_add_contact_global from './20260811_112125_add_contact_global';
import * as migration_20260814_074131_add_banner_avatar_media_image from './20260814_074131_add_banner_avatar_media_image';

export const migrations = [
  {
    up: migration_20260807_070543_add_identity_global.up,
    down: migration_20260807_070543_add_identity_global.down,
    name: '20260807_070543_add_identity_global',
  },
  {
    up: migration_20260811_112125_add_contact_global.up,
    down: migration_20260811_112125_add_contact_global.down,
    name: '20260811_112125_add_contact_global',
  },
  {
    up: migration_20260814_074131_add_banner_avatar_media_image.up,
    down: migration_20260814_074131_add_banner_avatar_media_image.down,
    name: '20260814_074131_add_banner_avatar_media_image'
  },
];
