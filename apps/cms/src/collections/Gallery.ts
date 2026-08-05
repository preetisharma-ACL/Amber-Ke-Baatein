import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate-site'

/**
 * गैलरी की तस्वीरें / the photographs on the गैलरी page.
 *
 * ── Media से अलग क्यों / why this is not just Media ──────────────────────────
 * Media में रचनाओं की मुख्य तस्वीरें भी रहती हैं — वे सब गैलरी में नहीं दिखनी
 * चाहिए। अलग collection रखने से "जो यहाँ है वही गैलरी में है" — कोई छिपा हुआ
 * नियम नहीं।
 *
 * Media also holds post cover images, and those should not all appear in the
 * gallery. Keeping them apart means what is in this collection is exactly what
 * the page shows — no `showInGallery` flag to remember, and nothing surprising
 * when a cover image silently turns up in the grid.
 *
 * ── आकार यहाँ नहीं बनते / no imageSizes here ─────────────────────────────────
 * Cloudinary माँगने पर आकार बदल देता है, इसलिए सिर्फ़ मूल तस्वीर जाती है।
 * Cloudinary resizes on demand from the URL, so only the original is uploaded.
 * See lib/cloudinary-adapter.ts.
 */
export const Gallery: CollectionConfig = {
  slug: 'gallery',
  labels: { singular: 'गैलरी तस्वीर / Gallery photo', plural: 'गैलरी / Gallery' },
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['caption', 'order', 'updatedAt'],
    group: 'सामग्री / Content',
    description:
      'गैलरी वाले पन्ने की तस्वीरें। यहाँ जो जोड़ेंगे वही साइट पर दिखेगा — क्रम बदलना हो तो नीचे का नंबर बदलिए।',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  // तस्वीर जोड़ते-हटाते ही साइट दोबारा बने / rebuild the site on any change.
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  upload: {
    mimeTypes: ['image/*'],
    // कोई imageSizes नहीं — ऊपर वाली टिप्पणी देखिए.
    focalPoint: true,
  },
  fields: [
    {
      name: 'caption',
      type: 'text',
      required: true,
      label: 'कैप्शन / Caption',
      admin: {
        description: 'तस्वीर के नीचे हाथ की लिखावट में दिखेगा — जैसे "अपनी गली में"।',
      },
    },
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt text / तस्वीर में क्या है',
      admin: {
        description:
          'स्क्रीन-रीडर इसे पढ़ते हैं और तस्वीर न खुलने पर यही दिखता है। एक छोटा वाक्य लिखिए।',
      },
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
