import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { config as loadEnv } from 'dotenv'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Categories } from './collections/Categories'
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
  },
  collections: [Posts, Categories, Media, Comments, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  // Astro दूसरे port पर चलता है, इसलिए browser को अनुमति देनी पड़ती है।
  // The site and the CMS are different origins, so the browser blocks fetches
  // (like posting a comment) unless the CMS names the site here explicitly.
  cors: [siteUrl],
  csrf: [siteUrl],
  sharp,
  plugins: [],
})
