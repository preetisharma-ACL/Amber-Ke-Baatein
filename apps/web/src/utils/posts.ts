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

/** रचना के ऊपर लगने वाली तस्वीर / the picture shown under a post's heading. */
export interface PostCover {
  /** Cloudinary का मूल पता / the untransformed original. */
  url: string;
  alt: string;
  /** तस्वीर के नीचे की पंक्ति / the optional line under it, from `media`. */
  caption?: string;
  width?: number;
  height?: number;
}

export interface Post {
  /** पते वाला हिस्सा / the slug, used as /posts/<id>. */
  id: string;
  /**
   * CMS का असली अंक वाला id / the numeric id the CMS uses.
   *
   * टिप्पणियाँ इसी से जुड़ी हैं — slug से नहीं.
   * Comments are related to a post by this numeric id, not by slug, so the
   * browser needs it to fetch and post comments. The `id` field above stays the
   * slug, because every component and every URL is built on it.
   */
  cmsId: number;
  data: PostData;
  /** रचना का शरीर, HTML में / the body, already rendered from Lexical. */
  html: string;
  /**
   * मुख्य तस्वीर / the cover image, shown under the heading. `null` = कोई नहीं.
   *
   * यह `media` के साथ नहीं रखी गई: `media` में वे चीज़ें हैं जो रचना के *बग़ल* की
   * पट्टी में जाती हैं और पन्ने को चौड़ा करती हैं। मुख्य तस्वीर शीर्षक के नीचे,
   * पढ़ने की चौड़ाई में रहती है और layout नहीं बदलती।
   *
   * Deliberately not part of `media`: that groups what goes in the side rail
   * and widens the page. A cover sits under the heading at the reading measure
   * and changes no layout, so grouping the two would make `hasMedia` — which
   * decides the two-column layout — accidentally true for a post that only has
   * a cover.
   */
  cover: PostCover | null;
  /**
   * ऊपर पूरी चौड़ाई में दिखने वाली तस्वीर / the wide banner behind the title.
   *
   * `null` का मतलब है "कुछ नहीं चढ़ाया" — तब पन्ना साइट की अपनी बनी-बनाई तस्वीर
   * लगाता है (`src/assets/poetry-banner.png`), देखिए PostLayout.
   *
   * ── मुख्य तस्वीर यहाँ जान-बूझकर नहीं आती / the cover deliberately does not
   * stand in ──
   * एक समय यह `coverImage` पर गिरता था. पर cover खड़ी या चौकोर होती है और यहाँ
   * उसे 4:1 में काटना पड़ता — यानी जो सबसे ज़रूरी था वही कटता. और चूँकि ज़्यादातर
   * रचनाओं में cover होती है, वह सहारा साइट की अपनी बनी-बनाई तस्वीर को कभी
   * दिखने ही नहीं देता — यानी वह तस्वीर बनवाने का कोई मतलब ही न रहता.
   *
   * This briefly fell back to `coverImage`. But a cover is portrait or square
   * and would be cropped to 4:1 here, which cuts exactly what mattered — and
   * since most posts have a cover, that fallback would mean the purpose-made
   * banner never appeared at all.
   */
  banner: PostCover | null;
  /**
   * रचना के साथ सुनने-देखने की चीज़ें / optional media shown beside the poem.
   * Both are optional and independent: a post may have neither, either, or both.
   */
  media: {
    /** Cloudinary पर रखी हुई आवाज़ / the recitation, if one was uploaded. */
    audioUrl?: string;
    audioTitle?: string;
    /** जैसा चिपकाया गया वैसा ही — पहचान साइट पर होती है, CMS में नहीं. */
    videoUrl?: string;
  };
}

/**
 * पड़ोसी रचना का पता / just enough of a post to link to it.
 *
 * पूरी `Post` नहीं भेजी जाती क्योंकि उसमें पूरा HTML शरीर होता है — हर पन्ने के
 * साथ दो और रचनाओं का पूरा पाठ जुड़ जाता, सिर्फ़ दो शीर्षक दिखाने के लिए।
 *
 * Deliberately not a whole `Post`: that carries the rendered body, so passing
 * two of them into every page would ship two extra poems' worth of HTML to
 * print two titles.
 */
export interface PostLink {
  slug: string;
  title: string;
  category: string;
  /** पढ़ने में कितना समय / the same estimate the post's own page prints. */
  minutes: number;
}

interface CmsCategory {
  name?: string;
}

interface CmsPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  displayDate: string;
  publishedAt: string;
  order: number;
  category: CmsCategory | number | null;
  content: LexicalRoot | null;
  audio?: { url?: string; title?: string } | number | null;
  videoUrl?: string | null;
  coverImage?: CmsCoverImage | number | null;
  bannerImage?: CmsCoverImage | number | null;
}

/** depth=1 पर पूरा object; सिर्फ़ id आए तो तस्वीर नहीं मानी जाती. */
interface CmsCoverImage {
  url?: string | null;
  alt?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

interface CmsResponse {
  docs: CmsPost[];
  totalDocs: number;
}

/**
 * एक ही बार CMS से पूछिए — पर सिर्फ़ build के समय.
 * Fetch once per build — but only when building.
 *
 * getStaticPaths, होम पन्ना और श्रेणी वाला पन्ना, तीनों यही माँगते हैं, इसलिए
 * build में एक ही बार पूछना ठीक है।
 * getStaticPaths, the homepage and the category page all ask for posts during
 * one build, so caching avoids three identical round-trips.
 *
 * dev में यह ज़हर है: CMS में रचना बदलने के बाद पन्ना पुराना ही दिखता रहेगा जब तक
 * dev server दोबारा न चले। इसलिए dev में हर बार ताज़ा माँगते हैं।
 * In dev this would be actively harmful: the module stays loaded between
 * requests, so after editing a post in the CMS the page would keep serving the
 * old copy until the dev server restarted. Dev therefore always refetches.
 */
let cache: Promise<Post[]> | null = null;

/**
 * चढ़ाई हुई तस्वीर को साफ़ आकार में / normalise an upload, or report its absence.
 *
 * बिना `url` वाली तस्वीर को "है ही नहीं" माना जाता है — अधूरा upload रचना के
 * ऊपर टूटा हुआ खाना दिखाने से बेहतर है कि दिखे ही नहीं.
 * A picture without a `url` counts as absent: a half-failed upload should leave
 * the poem looking exactly as it did, not put a broken frame above it.
 *
 * `alt` न हो तो शीर्षक — कोई भी वर्णन कोई वर्णन न होने से बेहतर है.
 * The title stands in for a missing `alt`: an imperfect description beats none.
 */
function image(
  value: CmsCoverImage | number | null | undefined,
  fallbackAlt: string
): PostCover | null {
  if (!value || typeof value !== 'object' || !value.url) return null;

  return {
    url: value.url,
    alt: value.alt?.trim() || fallbackAlt,
    caption: value.caption?.trim() || undefined,
    width: value.width ?? undefined,
    height: value.height ?? undefined,
  };
}

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
    cmsId: doc.id,
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
    cover: image(doc.coverImage, doc.title),
    banner: image(doc.bannerImage, doc.title),
    media: {
      // depth=1 से audio पूरा आता है; सिर्फ़ id आए तो चुपचाप छोड़ दीजिए.
      // At depth=1 the upload is populated; if it ever arrives as a bare id
      // there is nothing to play, so it is simply absent rather than broken.
      audioUrl:
        doc.audio && typeof doc.audio === 'object' ? (doc.audio.url ?? undefined) : undefined,
      audioTitle:
        doc.audio && typeof doc.audio === 'object' ? (doc.audio.title ?? undefined) : undefined,
      videoUrl: doc.videoUrl ?? undefined,
    },
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
  if (import.meta.env.DEV) {
    const fresh = await fetchPosts();
    return [...fresh].sort(
      (a, b) => b.data.order - a.data.order || a.data.title.localeCompare(b.data.title, 'hi')
    );
  }

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
