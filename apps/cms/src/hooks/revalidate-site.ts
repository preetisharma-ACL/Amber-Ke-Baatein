import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * रचना छपते ही साइट पर दिखे / make a published post show up on the site.
 *
 * ── समस्या क्या है / the problem ────────────────────────────────────────────
 * साइट static है। कौन-कौन से पन्ने बनेंगे, यह `getStaticPaths` तय करता है, और
 * Astro उसका नतीजा सँभालकर रख लेता है। इसलिए नई रचना सूची में तो आ जाती है, पर
 * उसका अपना पन्ना नहीं बनता।
 *
 * The site is static: `getStaticPaths` in posts/[slug].astro decides which post
 * pages exist. Astro caches that result, so publishing produced a confusing
 * split — the post appeared in the listings (they refetch per request) while
 * its own page 404'd. The author would click Publish and find a broken link.
 *
 * ── दो हालात, दो रास्ते / two environments, two answers ──────────────────────
 * dev  — CMS और साइट एक ही मशीन पर हैं, तो उस फ़ाइल को छू देना काफ़ी है; Astro
 *        रास्ते दोबारा गिन लेता है।
 * prod — साइट पहले से बनी हुई है, तो होस्ट का deploy hook चलाना पड़ता है।
 *
 * In development both apps run on one machine, so touching the route file is
 * enough — Astro recomputes the paths within a second or two. In production the
 * site is prebuilt, so the only way to add a page is to trigger a rebuild via
 * the host's deploy hook (`SITE_DEPLOY_HOOK_URL`).
 *
 * ── यह कभी save नहीं रोकता / this never blocks a save ───────────────────────
 * Every failure here is swallowed and logged. Losing a rebuild is a nuisance;
 * losing someone's writing because a file was read-only or a webhook was down
 * is not acceptable.
 */

const routeFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../web/src/pages/posts/[slug].astro',
)

type Logger = { info: (msg: string) => void; warn: (msg: string) => void }

function revalidate(logger: Logger, reason: string): void {
  const deployHook = process.env.SITE_DEPLOY_HOOK_URL

  if (deployHook) {
    // वादा नहीं देखते — save इंतज़ार न करे / fire and forget; the save must not wait.
    void fetch(deployHook, { method: 'POST' })
      .then((res) =>
        res.ok
          ? logger.info(`site rebuild triggered (${reason})`)
          : logger.warn(`deploy hook returned ${res.status} (${reason})`),
      )
      .catch((err) => logger.warn(`deploy hook failed: ${(err as Error).message}`))
    return
  }

  if (process.env.NODE_ENV === 'production') {
    logger.warn(
      `SITE_DEPLOY_HOOK_URL not set — "${reason}" will not appear on the built site until someone runs a rebuild.`,
    )
    return
  }

  // dev: फ़ाइल को छू दीजिए, Astro बाक़ी सँभाल लेगा.
  try {
    const now = new Date()
    fs.utimesSync(routeFile, now, now)
    logger.info(`touched posts/[slug].astro so the dev site picks up: ${reason}`)
  } catch (err) {
    logger.warn(`could not touch the Astro route file: ${(err as Error).message}`)
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  revalidate(req.payload.logger, `${String(doc?.slug ?? 'post')} saved`)
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidate(req.payload.logger, `${String(doc?.slug ?? 'post')} deleted`)
  return doc
}
