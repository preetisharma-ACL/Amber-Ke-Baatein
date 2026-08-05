import type { Endpoint } from 'payload'

/**
 * पसंद का बटन / the like button's backend.
 * POST /api/posts/:slug/like  ->  { likes: number }
 *
 * ── यह खुला रास्ता है, इसलिए सावधानी / this is a public write, so it is guarded ──
 * बिना लॉगिन कोई भी दबा सकता है — यही मक़सद है। पर खुला रास्ता होने का मतलब है कि
 * कोई इसे हज़ार बार भी दबा सकता है।
 *
 * Anyone can call this without logging in — that is the point of a like button.
 * But a public write endpoint is a public write endpoint: a loop can call it a
 * thousand times a second. The browser also remembers a like in localStorage,
 * but that is a convenience for the reader, not a control — it is trivially
 * bypassed and cannot be trusted.
 *
 * So the real limit lives here, per IP. It is deliberately simple: an in-memory
 * sliding window. Honest limitations of that choice:
 *   • यह याद server के साथ ही मिट जाती है / it resets when the CMS restarts
 *   • कई instance चलें तो हर एक की अपनी गिनती होगी / each instance counts alone
 *   • एक ही दफ़्तर/college के सब लोग एक IP साझा कर सकते हैं / shared NATs share a bucket
 * For a personal blog that is the right amount of machinery. If likes ever
 * start mattering, move the counting to the database with a per-visitor row.
 */

/** एक IP, एक मिनट में इतनी बार / requests allowed per IP per window. */
const MAX_PER_WINDOW = 10
const WINDOW_MS = 60_000

const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  // नक़्शा बढ़ता न रहे / keep the map from growing without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key)
    }
  }

  return recent.length > MAX_PER_WINDOW
}

/** proxy के पीछे असली पता / the real client address behind a proxy. */
function clientIp(req: { headers: Headers }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export const likePost: Endpoint = {
  path: '/:slug/like',
  method: 'post',
  handler: async (req) => {
    const slug = req.routeParams?.slug
    if (typeof slug !== 'string' || !slug) {
      return Response.json({ error: 'slug missing' }, { status: 400 })
    }

    if (rateLimited(clientIp(req))) {
      return Response.json(
        { error: 'थोड़ा रुकिए / too many requests, slow down.' },
        { status: 429 },
      )
    }

    // सिर्फ़ छपी हुई रचना / only a published post can be liked. overrideAccess is
    // false so this uses the same "published only" rule the public API does —
    // a draft's like count should not be nudgeable from outside.
    const found = await req.payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
    })

    const post = found.docs[0]
    if (!post) {
      return Response.json({ error: 'रचना नहीं मिली / no such post' }, { status: 404 })
    }

    const likes = (typeof post.likes === 'number' ? post.likes : 0) + 1

    /**
     * `likes` admin में read-only है, इसलिए यहाँ overrideAccess चाहिए.
     * The field is admin-read-only so nobody edits counters by hand; that same
     * rule would block this update, hence overrideAccess here. Version history
     * is skipped too — a like is not an edit of the writing, and without this
     * every tap would burn one of the 20 retained versions of the post.
     */
    await req.payload.update({
      collection: 'posts',
      id: post.id,
      data: { likes },
      overrideAccess: true,
      draft: false,
    })

    return Response.json({ likes })
  },
}

/**
 * गिनती पढ़िए / read the current count without changing it.
 * GET /api/posts/:slug/likes -> { likes: number }
 *
 * The page is built ahead of time, so the number baked into the HTML is stale
 * the moment someone else taps. The browser asks for the live figure on load.
 */
export const getLikes: Endpoint = {
  path: '/:slug/likes',
  method: 'get',
  handler: async (req) => {
    const slug = req.routeParams?.slug
    if (typeof slug !== 'string' || !slug) {
      return Response.json({ error: 'slug missing' }, { status: 400 })
    }

    const found = await req.payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
    })

    const post = found.docs[0]
    if (!post) return Response.json({ error: 'no such post' }, { status: 404 })

    return Response.json({ likes: typeof post.likes === 'number' ? post.likes : 0 })
  },
}
