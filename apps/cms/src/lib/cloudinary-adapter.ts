import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import { v2 as cloudinary } from 'cloudinary'

/**
 * तस्वीरें Cloudinary पर / store uploads on Cloudinary.
 *
 * ── यह ख़ुद क्यों लिखना पड़ा / why this is hand-written ────────────────────────
 * Payload S3, Azure, GCS, Vercel Blob और UploadThing के लिए तैयार adapter देता
 * है — Cloudinary के लिए नहीं।
 *
 * Payload ships official adapters for S3, Azure, GCS, Vercel Blob and
 * UploadThing. There is no Cloudinary one, so this implements the four methods
 * `@payloadcms/plugin-cloud-storage` asks for. It is deliberately small: the
 * plugin owns the collection wiring, this only moves bytes.
 *
 * ── आकार बदलना Cloudinary के ज़िम्मे / Cloudinary does the resizing ───────────
 * इसीलिए Cloudinary चुना गया। यहाँ सिर्फ़ मूल तस्वीर जाती है; छोटा-बड़ा करना
 * URL से होता है, माँगने पर।
 *
 * Only the original is uploaded. Sizes are produced on demand from the URL
 * (`.../upload/w_420,f_auto,q_auto/...`), which is why the collections here do
 * not configure Payload's `imageSizes`: generating fixed derivatives at upload
 * time would mean uploading several near-duplicate files and still being unable
 * to serve a size nobody thought of in advance.
 */

const REQUIRED = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const

const missingCredentials = () => REQUIRED.filter((key) => !process.env[key])

/**
 * जानकारी हो तो लगा दीजिए, न हो तो उसी वक़्त रोकिए — पहले नहीं.
 *
 * बिना Cloudinary के भी CMS चलना चाहिए: रचनाएँ, टिप्पणियाँ, autofill — सब काम
 * करते रहें। सिर्फ़ तस्वीर चढ़ाना रुके, और साफ़ कारण के साथ।
 *
 * Configure lazily and fail at the point of use, not at startup. An earlier
 * version threw during `onInit`, which meant a missing Cloudinary key took the
 * entire CMS down — no posts, no comments, no autofill — over a feature the
 * author might not touch that day. Uploads are the only thing that genuinely
 * cannot work, so uploads are the only thing that fails.
 */
function requireCloudinary(): void {
  const missing = missingCredentials()
  if (missing.length) {
    throw new Error(
      `Cloudinary की जानकारी अधूरी है — तस्वीर नहीं चढ़ सकती। / missing ${missing.join(', ')}. ` +
        `Add them to the repo-root .env and restart the CMS.`,
    )
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

/** सब कुछ एक ही जगह / everything lands under one folder, per collection. */
const folderFor = (collectionSlug: string, prefix?: string) =>
  ['amber', collectionSlug, prefix].filter(Boolean).join('/')

/**
 * Cloudinary का `public_id` — extension के बिना.
 * Cloudinary keys a file by an id that excludes the extension; it tracks the
 * format separately. Deriving the id from the filename (rather than storing it
 * in a database column) keeps upload and delete in agreement without an extra
 * field to migrate or keep in sync.
 */
const publicIdFor = (collectionSlug: string, filename: string, prefix?: string) => {
  const withoutExt = filename.replace(/\.[^./]+$/, '')
  return `${folderFor(collectionSlug, prefix)}/${withoutExt}`
}

const AUDIO_VIDEO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|mp4|mov|webm|m4v)$/i

/**
 * Cloudinary में आवाज़ भी "video" के खाने में जाती है.
 *
 * Cloudinary files audio under `resource_type: 'video'` — there is no separate
 * audio type. Getting this wrong is not a soft failure: an mp3 uploaded as
 * `image` is rejected, and a delete issued against the wrong type silently
 * leaves the file on the account while removing the database row.
 *
 * Derived from the filename because `handleDelete` and `generateURL` are given
 * a filename but no mime type.
 */
const resourceTypeFor = (filename: string, mimeType?: string): 'image' | 'video' => {
  if (mimeType?.startsWith('audio/') || mimeType?.startsWith('video/')) return 'video'
  return AUDIO_VIDEO_EXT.test(filename) ? 'video' : 'image'
}

export const cloudinaryAdapter =
  (): Adapter =>
  ({ collection, prefix }): GeneratedAdapter => ({
    name: 'cloudinary',

    onInit: () => {
      const missing = missingCredentials()
      if (missing.length) {
        // चेतावनी, रुकावट नहीं / warn, but let the CMS run — see requireCloudinary.
        console.warn(
          `[cloudinary] ${missing.join(', ')} not set — image uploads will fail ` +
            `until they are added to the repo-root .env. Everything else works.`,
        )
        return
      }
      requireCloudinary()
    },

    handleUpload: async ({ file }) => {
      requireCloudinary()
      const publicId = publicIdFor(collection.slug, file.filename, prefix)

      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            // वही नाम दोबारा आए तो बदल दीजिए / replace rather than duplicate on
            // re-upload, so the URL stored in the database stays valid.
            overwrite: true,
            invalidate: true,
            resource_type: resourceTypeFor(file.filename, file.mimeType),
          },
          (error) => (error ? reject(error) : resolve()),
        )
        stream.end(file.buffer)
      })
    },

    handleDelete: async ({ doc, filename }) => {
      const publicId = publicIdFor(collection.slug, filename, (doc as { prefix?: string }).prefix)
      // पहले ही हट चुकी हो तो शिकायत नहीं / a missing file is not an error:
      // Cloudinary returns "not found" rather than throwing, and a delete that
      // fails here would otherwise block removing the row.
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceTypeFor(filename),
        invalidate: true,
      })
    },

    generateURL: ({ filename, prefix: urlPrefix }) =>
      cloudinary.url(publicIdFor(collection.slug, filename, urlPrefix), {
        secure: true,
        resource_type: resourceTypeFor(filename),
        // कोई transformation नहीं — साइट अपनी ज़रूरत के हिसाब से जोड़ती है.
        // No transformation baked in. The site inserts what it needs into the
        // URL (see apps/web/src/utils/gallery.ts), so one stored URL serves
        // every size instead of one URL per size.
      }),

    /**
     * Payload के अपने रास्ते से माँगी गई फ़ाइल / a file requested through
     * Payload's own `/api/<collection>/file/<name>` route.
     *
     * Redirecting rather than proxying is the point: the bytes come straight
     * from Cloudinary's CDN instead of travelling through the CMS, which keeps
     * a small Node server out of the image-serving path entirely.
     */
    staticHandler: (_req, { params }) =>
      Response.redirect(
        cloudinary.url(publicIdFor(params.collection, params.filename, params.prefix), {
          secure: true,
          resource_type: resourceTypeFor(params.filename),
        }),
        302,
      ),
  })
