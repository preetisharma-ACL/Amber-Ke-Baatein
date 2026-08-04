/**
 * apps/web और apps/cms के बीच साझा definitions.
 * Shared between the Astro site and the Payload CMS.
 *
 * यहाँ सिर्फ़ वही रखिए जो दोनों तरफ़ चाहिए — कोई dependency नहीं, कोई build step नहीं।
 * Keep this dependency-free and build-free: both apps import the TypeScript
 * source directly, so anything imported here must work under Vite *and* SWC.
 *
 * NOTE: row-shaped types generated from the Payload schema live in
 * apps/cms/src/payload-types.ts (run `npm run generate:types`). These are the
 * hand-written, transport-level shapes the Astro side actually consumes.
 */

export {
  escapeHtml,
  lexicalToHtml,
  lexicalToPlainText,
  type LexicalNode,
  type LexicalRoot,
} from './lexical'

/** हर पन्ने पर दिखने वाला "सभी" फ़िल्टर / the "all" pseudo-category. */
export const ALL_CATEGORIES = 'सभी'

/** एक रचना की स्थिति / publication state of a post. */
export const POST_STATUSES = ['draft', 'published'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

/**
 * टिप्पणी की स्थिति / moderation state of a comment.
 * `pending` डिफ़ॉल्ट है — बिना स्वीकृति कुछ भी साइट पर नहीं दिखता।
 * New comments land in `pending`; nothing reaches the site unapproved.
 */
export const COMMENT_STATUSES = ['pending', 'approved', 'spam'] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

export interface Category {
  id: number
  /** श्रेणी का नाम, e.g. "संस्मरण", "कविता" */
  name: string
  slug: string
  description?: string | null
}

export interface MediaFile {
  id: number
  url: string
  alt: string
  width?: number | null
  height?: number | null
}

export interface Post {
  id: number
  title: string
  slug: string
  excerpt: string

  /**
   * जैसा लिखा है वैसा ही दिखता है, e.g. "1 अगस्त 2026".
   *
   * Deliberately a plain string, carried over from the original frontmatter
   * schema: Hindi date strings are not JS-Date-parseable, so they are stored
   * and rendered verbatim. Sorting uses `publishedAt`/`order` instead — never
   * try to parse this.
   */
  displayDate: string

  /** असली timestamp — क्रम इसी से लगता है / real timestamp, used for ordering. */
  publishedAt: string

  /**
   * हाथ से क्रम बदलने के लिए / manual sort override; higher shows first.
   * Ties fall back to `publishedAt`. Mirrors the old frontmatter `order`.
   */
  order: number

  status: PostStatus
  category?: Category | null
  coverImage?: MediaFile | null

  /** Lexical richtext document — render via the CMS's serializer. */
  content: unknown

  views: number
  likes: number
}

export interface Comment {
  id: number
  postId: number
  authorName: string
  /** कभी साइट पर नहीं दिखता / never exposed publicly, admin-only. */
  authorEmail?: string | null
  body: string
  status: CommentStatus
  createdAt: string
}

/**
 * रचनाओं का क्रम / the one sort order used everywhere.
 *
 * `order` पहले, फिर नई तारीख़, फिर शीर्षक — ताकि हर build में क्रम एक जैसा रहे.
 * Manual `order` wins, then newest first, then title so the result is stable
 * across builds. Kept here so the site and any CMS-side preview agree.
 */
export function comparePosts(a: Post, b: Post): number {
  return (
    b.order - a.order ||
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
    a.title.localeCompare(b.title, 'hi')
  )
}
