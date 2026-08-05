import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'

/**
 * रचना का पाठ / recordings — the poet reading their own work.
 *
 * हिन्दी कविता सुनने की चीज़ भी है। जो पाठक पढ़ नहीं पाते या पढ़ना नहीं चाहते,
 * उनके लिए आवाज़ ही असली रचना है।
 *
 * Hindi poetry is meant to be heard as much as read — metre and pause do not
 * survive on a page. A recitation is not an accessory to the text here; for
 * many readers it is the better version of it.
 *
 * Stored on Cloudinary like everything else. Note that Cloudinary files audio
 * under `resource_type: 'video'` — handled in lib/cloudinary-adapter.ts.
 */
export const Audio: CollectionConfig = {
  slug: 'audio',
  labels: { singular: 'आवाज़ / Audio', plural: 'आवाज़ें / Audio' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
    group: 'सामग्री / Content',
    description: 'रचना पढ़कर रिकॉर्ड की हुई फ़ाइल — mp3 या m4a।',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  upload: {
    mimeTypes: ['audio/*'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'नाम / Title',
      admin: {
        description: 'सिर्फ़ पहचानने के लिए — जैसे "कुछ पाया — पाठ"।',
      },
    },
  ],
}
