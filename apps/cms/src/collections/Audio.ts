import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate-site'

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
    description:
      'रचना पढ़कर रिकॉर्ड की हुई फ़ाइल — mp3 या m4a। यहाँ जो चढ़ेगा वह गैलरी के "आलोक की आवाज़ें" खाने में भी दिखेगा, और रचना के साथ भी लगाया जा सकता है।',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  // आवाज़ अब गैलरी में भी दिखती है, इसलिए बदलने पर साइट दोबारा बननी चाहिए /
  // recordings now appear on the gallery page too, so a change here has to
  // rebuild the site the way adding a photograph does.
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
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
        description: 'गैलरी में यही दिखेगा, और रचना के साथ लगाते समय पहचानने के काम आएगा — जैसे "कुछ पाया — पाठ"।',
      },
    },
    {
      /**
       * क्रम / sort order, same rule as gallery photographs.
       *
       * यह तब जुड़ा जब आवाज़ें गैलरी में दिखने लगीं। इससे पहले आवाज़ सिर्फ़ रचना के
       * साथ लगती थी, जहाँ क्रम का कोई मतलब ही नहीं था.
       *
       * Added when recordings started appearing on the gallery page. Before
       * that a recording was only ever attached to one post, where ordering had
       * no meaning. Existing rows default to 0 and fall back to newest-first.
       */
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
      label: 'क्रम / Sort order',
      admin: {
        position: 'sidebar',
        description: 'बड़ा नंबर पहले दिखता है। सामान्यतः 0 ही रहने दीजिए।',
      },
    },
  ],
}
