import { postgresAdapter } from '@payloadcms/db-postgres'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import {
  AlignFeature,
  BlocksFeature,
  CodeBlock,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { config as loadEnv } from 'dotenv'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { VerseBlock } from './blocks/Verse'
import { Audio } from './collections/Audio'
import { Categories } from './collections/Categories'
import { Gallery } from './collections/Gallery'
import { draftFromPoem } from './endpoints/draft-from-poem'
import { cloudinaryAdapter } from './lib/cloudinary-adapter'
import { Comments } from './collections/Comments'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// .env monorepo की जड़ पर है — apps/web और apps/cms दोनों वही फ़ाइल पढ़ते हैं।
// Loaded here rather than only in next.config because this file is also
// imported by the Payload CLI (`payload migrate`, `generate:types`), which
// runs outside Next and so gets none of Next's automatic .env handling.
// dotenv does not overwrite already-set vars, so real environment variables
// in production still take precedence.
loadEnv({ path: path.resolve(dirname, '../../../.env') })

/** Astro साइट का पता / where the public site runs — needed for CORS. */
const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321'
const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

export default buildConfig({
  serverURL: serverUrl,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— अम्बर की बातें',
    },
    /**
     * <html> पर server और client का मेल न बैठने की चेतावनी बंद.
     *
     * Payload खुद <html data-theme dir lang> render करता है — हम नहीं.
     * Payload's own RootLayout owns the <html> element and renders
     * `data-theme` from a cookie, plus `dir="LTR"` in uppercase which the
     * browser normalises to lowercase in the DOM. Both differ between the
     * server pass and the client pass through no fault of this project, and
     * this flag is the officially supported knob for exactly that — it is read
     * as `config.admin.suppressHydrationWarning` and applied to <html>.
     *
     * ध्यान दीजिए / note: this scopes to the <html> tag only. It does not hide
     * hydration bugs inside the app's own components.
     */
    suppressHydrationWarning: true,
  },

  /**
   * REST/local API का डिफ़ॉल्ट depth — 2 से घटाकर 0.
   *
   * Every extra depth level is another sequential SELECT, and against a
   * database this far away each one costs a full ~330ms round trip. Callers
   * that genuinely need relationships ask for them explicitly: the Astro site
   * requests `?depth=1` to get category names, and the admin passes its own
   * depth. Nothing relies on the old default of 2.
   */
  defaultDepth: 0,
  collections: [Posts, Categories, Gallery, Audio, Media, Comments, Users],

  // कविता चिपकाकर खाने भरने वाला रास्ता / the Claude autofill endpoint,
  // reachable at POST /api/draft-from-poem. Staff-only; see the handler.
  endpoints: [draftFromPoem],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      // "बीचोंबीच" वाली पंक्ति के लिए / powers the centred single line, which
      // used to be written as raw <p class="center">.
      AlignFeature(),
      // कविता का बटन / gives the author a "कविता" button instead of raw HTML.
      // CodeBlock इसलिए कि ``` वाले हिस्से सही से आएँ — बिना इसके markdown का
      // fence टूटकर सादा text बन जाता है और अंदर का `---` लकीर बन जाता है।
      // CodeBlock is required for ``` fences to survive conversion at all:
      // without it the fence markers become literal text and a `---` inside the
      // example is misread as a horizontal rule.
      BlocksFeature({ blocks: [VerseBlock, CodeBlock()] }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',

      /**
       * ── ये सब सिर्फ़ connection बनने का ख़र्च बचाते हैं, दूरी का नहीं ──────────
       * These settings only reduce *connection setup* cost. They cannot reduce
       * per-query latency, which is dominated by physical distance to Neon
       * (measured: ~330ms per round trip to us-east-2 from here). Keeping a
       * connection alive matters a lot precisely because rebuilding one costs
       * ~4s: TCP handshake alone measured 1.5s, then TLS and auth on top.
       */

      // खुला connection बंद न हो / keep sockets warm rather than re-handshaking.
      idleTimeoutMillis: 60_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,

      // Neon के free tier पर connection सीमित हैं / Neon's free tier caps
      // connections; 10 is plenty for a single-author CMS and leaves headroom.
      max: 10,

      // जुड़ न पाए तो जल्दी हार मानिए / fail fast instead of hanging a request.
      connectionTimeoutMillis: 15_000,
    },
  }),
  // Astro दूसरे port पर चलता है, इसलिए browser को अनुमति देनी पड़ती है।
  // The site and the CMS are different origins, so the browser blocks fetches
  // (like posting a comment) unless the CMS names the site here explicitly.
  cors: [siteUrl],
  csrf: [siteUrl],
  sharp,
  plugins: [
    /**
     * तस्वीरें Cloudinary पर, disk पर नहीं.
     * Uploads go to Cloudinary rather than local disk. Local disk does not
     * survive a redeploy on any host worth using, and Cloudinary also lets
     * the site ask for any size from the URL instead of the CMS generating
     * a fixed set at upload time.
     */
    cloudStoragePlugin({
      collections: {
        gallery: { adapter: cloudinaryAdapter() },
        audio: { adapter: cloudinaryAdapter() },
        media: { adapter: cloudinaryAdapter() },
      },
    }),
  ],
})
