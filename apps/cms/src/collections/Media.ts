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
    /**
     * कोई पहले से बने आकार नहीं — Cloudinary माँगने पर बदल देता है.
     *
     * पहले यहाँ thumbnail/card/hero बनते थे। अब सिर्फ़ मूल तस्वीर जाती है और
     * साइट URL में आकार माँग लेती है।
     *
     * This used to pre-generate thumbnail/card/hero derivatives with sharp.
     * With Cloudinary storing the uploads, only the original goes up and any
     * size is produced on demand from the URL — so a size nobody anticipated
     * costs nothing, and one upload stops becoming four near-duplicate files.
     * See lib/cloudinary-adapter.ts.
     */
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
