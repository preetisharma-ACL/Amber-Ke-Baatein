import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'

/**
 * तस्वीरें और फ़ाइलें / uploaded images and files.
 *
 * अभी फ़ाइलें सर्वर की disk पर जाती हैं (apps/cms/media/)।
 * Files currently land on local disk at apps/cms/media/, which is fine for
 * development. Serverless hosts have an ephemeral filesystem, so before
 * deploying switch this to object storage — see @payloadcms/storage-s3
 * (works with Cloudflare R2) or @payloadcms/storage-vercel-blob.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'तस्वीर / Media', plural: 'तस्वीरें / Media' },
  admin: {
    group: 'सामग्री / Content',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  upload: {
    mimeTypes: ['image/*'],
    // साइट को हर जगह पूरी तस्वीर नहीं चाहिए — छोटे आकार पहले से बना लेते हैं।
    // Pre-generate the sizes the site actually uses so the browser never
    // downloads a 4MB original to fill a 400px card.
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 512, position: 'centre' },
      { name: 'hero', width: 1600, height: undefined },
    ],
    focalPoint: true,
  },
  fields: [
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
      name: 'caption',
      type: 'text',
      label: 'कैप्शन / Caption (वैकल्पिक)',
      admin: {
        description: 'तस्वीर के नीचे दिखने वाली पंक्ति। खाली छोड़ सकते हैं।',
      },
    },
  ],
}
