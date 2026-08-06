import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { validateVideoUrl } from '../fields/video-url'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate-site'

/**
 * चलचित्र / the videos on the गैलरी page.
 *
 * ── फ़ाइल क्यों नहीं चढ़ती / why this holds a link, not a file ─────────────────
 * तस्वीरें और आवाज़ें Cloudinary पर चढ़ती हैं, वीडियो नहीं। फ़ोन का एक वीडियो
 * अक्सर 100MB से ऊपर होता है — चढ़ाने में देर, और Cloudinary के मुफ़्त खाते की
 * पूरी जगह चार-पाँच वीडियो में ख़त्म। जो वीडियो पहले से YouTube या Instagram पर
 * है, उसका लिंक चिपका देना सस्ता भी है और तेज़ भी।
 *
 * Photographs and recordings are uploaded to Cloudinary; videos are not. A phone
 * video is routinely over 100MB — slow to upload, and Cloudinary's free tier is
 * roughly 25GB of storage and bandwidth combined, which a handful of videos
 * would exhaust. These videos already live on YouTube or Instagram, so this
 * stores where to find one rather than a second copy of it.
 *
 * ── एक ही खाना, दोनों मंचों के लिए / one field, both platforms ────────────────
 * रचनाओं वाले `videoUrl` की तरह ही — लिंक ख़ुद बता देता है कि वह किसका है।
 *
 * Exactly like `videoUrl` on a post: the author pastes what they copied and the
 * site works out YouTube vs Instagram from the link itself
 * (apps/web/src/utils/embeds.ts). Asking them to classify it first would be
 * asking them to do work the URL already answers.
 */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'चलचित्र / Video', plural: 'चलचित्र / Videos' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'videoUrl', 'order', 'updatedAt'],
    group: 'सामग्री / Content',
    description:
      'गैलरी के "चलचित्र" खाने में दिखने वाले वीडियो। YouTube या Instagram का लिंक चिपकाइए — फ़ाइल चढ़ाने की ज़रूरत नहीं।',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  // वीडियो जोड़ते-हटाते ही साइट दोबारा बने / rebuild the site on any change,
  // exactly as adding a photograph does.
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'नाम / Title',
      admin: {
        description: 'वीडियो के नीचे दिखेगा — जैसे "एक शाम, एक कविता"।',
      },
    },
    {
      name: 'videoUrl',
      type: 'text',
      required: true,
      label: 'वीडियो लिंक / Video link',
      admin: {
        description:
          'YouTube या Instagram reel का लिंक, जैसा है वैसा ही चिपकाइए। tracking वाला हिस्सा साइट ख़ुद हटा देती है।',
      },
      validate: validateVideoUrl,
    },
    {
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
