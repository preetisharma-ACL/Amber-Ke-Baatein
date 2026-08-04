import { ALL_CATEGORIES, lexicalToHtml, type LexicalRoot } from '@amber/shared';

// CategoryFilter इसे यहीं से लेता है / re-exported so CategoryFilter keeps its
// existing import path and does not need to know about @amber/shared.
export { ALL_CATEGORIES };

/**
 * रचनाएँ अब CMS से आती हैं, markdown से नहीं.
 * Posts now come from Payload (Neon), not from local markdown files.
 *
 * ── आकार जान-बूझकर वही रखा है / the shape is deliberately unchanged ──────────
 * `id` अब भी slug है और सब कुछ `data` के अंदर है — बिलकुल पहले जैसा.
 * `id` is still the slug and the fields still live under `data`, exactly as
 * Astro's content collections exposed them. That is not accidental: PostCard,
 * PostList, PostLayout and the category page all read `post.id` and
 * `post.data.*`, so keeping this shape meant the migration touched two files
 * instead of six, and the rendered markup is provably identical.
 */

/** CMS कहाँ चल रहा है / where the CMS lives (root .env, PUBLIC_CMS_URL). */
const CMS_URL = import.meta.env.PUBLIC_CMS_URL ?? 'http://localhost:3456';

export interface PostData {
  /** जैसा लिखा है वैसा ही, e.g. "1 अगस्त 2026" — इसे parse मत कीजिए. */
  date: string;
  category: string;
  title: string;
  excerpt: string;
  order: number;
}

export interface Post {
  /** पते वाला हिस्सा / the slug, used as /posts/<id>. */
  id: string;
  data: PostData;
  /** रचना का शरीर, HTML में / the body, already rendered from Lexical. */
  html: string;
}

interface CmsCategory {
  name?: string;
}

interface CmsPost {
  slug: string;
  title: string;
  excerpt: string;
  displayDate: string;
  publishedAt: string;
  order: number;
  category: CmsCategory | number | null;
  content: LexicalRoot | null;
}

interface CmsResponse {
  docs: CmsPost[];
  totalDocs: number;
}

/**
 * एक ही बार CMS से पूछिए / fetch once per build.
 *
 * getStaticPaths, होम पन्ना और श्रेणी वाला पन्ना — तीनों यही चाहते हैं.
 * getStaticPaths, the homepage and the category page each ask for posts during
 * the same build; without this the CMS would be hit three times for identical
 * data.
 */
let cache: Promise<Post[]> | null = null;

async function fetchPosts(): Promise<Post[]> {
  const url = `${CMS_URL}/api/posts?depth=1&limit=200&sort=-order`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    // CMS बंद हो तो build खाली साइट न बनाए — साफ़-साफ़ रुक जाए.
    // Fail loudly. A silent empty result here would publish a site with zero
    // posts and look like a content problem rather than a stopped CMS.
    throw new Error(
      `रचनाएँ नहीं मिलीं / could not reach the CMS at ${CMS_URL}.\n` +
        `Start it with "npm run dev:cms" (it must be running to build the site).`,
      { cause }
    );
  }

  if (!response.ok) {
    throw new Error(`CMS returned HTTP ${response.status} for ${url}`);
  }

  const body = (await response.json()) as CmsResponse;

  return body.docs.map((doc) => ({
    id: doc.slug,
    data: {
      date: doc.displayDate,
      // depth=1 से category पूरी आती है; कभी सिर्फ़ id आए तो खाली रखिए.
      category:
        doc.category && typeof doc.category === 'object' ? (doc.category.name ?? '') : '',
      title: doc.title,
      excerpt: doc.excerpt,
      order: doc.order ?? 0,
    },
    html: lexicalToHtml(doc.content),
  }));
}

/**
 * सारी रचनाएँ, नई पहले / all posts, newest first.
 *
 * बिना लॉगिन CMS सिर्फ़ छपी हुई रचनाएँ देता है, इसलिए draft यहाँ आते ही नहीं.
 * The public CMS API only returns published posts, so drafts are filtered out
 * server-side — this no longer needs its own draft check.
 *
 * Hindi dates are not sortable, so ordering uses the numeric `order` field
 * (higher = newer), exactly as the old frontmatter did. Ties fall back to title
 * so the output stays stable between builds.
 */
export async function getPosts(): Promise<Post[]> {
  cache ??= fetchPosts();
  const posts = await cache;
  return [...posts].sort(
    (a, b) => b.data.order - a.data.order || a.data.title.localeCompare(b.data.title, 'hi')
  );
}

/** होम पन्ने के लिए नई तीन रचनाएँ / latest N posts for the homepage. */
export async function getLatestPosts(limit = 3): Promise<Post[]> {
  return (await getPosts()).slice(0, limit);
}

/**
 * सारी श्रेणियाँ, "सभी" सबसे पहले / every category, with "सभी" first.
 * Derived from the posts themselves so an empty category never shows a chip
 * that filters to nothing — same behaviour as before.
 */
export async function getCategories(): Promise<string[]> {
  const posts = await getPosts();
  const unique = [...new Set(posts.map((p) => p.data.category).filter(Boolean))];
  return [ALL_CATEGORIES, ...unique];
}
