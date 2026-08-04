import { withPayload } from '@payloadcms/next/withPayload'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// .env monorepo की जड़ पर है, इस app के अंदर नहीं।
// The .env lives at the monorepo root so apps/web and apps/cms share one file.
// dotenv never overwrites vars that are already set, so real environment
// variables in production still win over this file.
loadEnv({ path: path.resolve(dirname, '../../.env') })

const nextConfig: NextConfig = {
  // @amber/shared TypeScript source भेजता है, compiled JS नहीं।
  // The shared workspace package ships raw .ts (no build step), so Next has to
  // compile it instead of treating it as a prebuilt node_modules dependency.
  transpilePackages: ['@amber/shared'],

  // Astro साइट frontend है; यह app सिर्फ़ admin + API देता है।
  // Astro is the public site — this app only serves /admin and /api, so send
  // anyone landing on the bare origin to the admin panel.
  async redirects() {
    return [{ source: '/', destination: '/admin', permanent: false }]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    // monorepo की जड़, apps/cms नहीं।
    // Must be the workspace root: npm hoists `next` into the repo-root
    // node_modules, and the template's default of `apps/cms` leaves Turbopack
    // unable to resolve next/package.json — it fails the build outright with
    // "Next.js inferred your workspace root, but it may not be correct."
    root: path.resolve(dirname, '../..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
