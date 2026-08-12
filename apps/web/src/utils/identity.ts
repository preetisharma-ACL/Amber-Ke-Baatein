import { site } from '../data/site';

/**
 * लेखक का परिचय, CMS से / the author's identity, from the CMS.
 *
 * नाम, भूमिका, परिचय, दस्तख़त — ये सब पहले `data/site.ts` में गड़े हुए थे। अब
 * `/admin` → परिचय में बदलते हैं, और Save करते ही साइट दोबारा बन जाती है।
 *
 * These used to be hardcoded constants. They now come from the `identity`
 * global in Payload, so the name on the homepage can be changed by the person
 * whose name it is. See apps/cms/src/globals/SiteIdentity.ts.
 */

/** CMS कहाँ चल रहा है / where the CMS lives (root .env, PUBLIC_CMS_URL). */
const CMS_URL = import.meta.env.PUBLIC_CMS_URL ?? 'http://localhost:3456';

/**
 * CMS से चढ़ाई हुई तस्वीर / an image uploaded through the CMS.
 * `null` का मतलब है "कुछ नहीं चढ़ाया" — तब repo वाली पुरानी तस्वीर चलती है।
 * `null` means nothing was uploaded, in which case the caller uses the picture
 * bundled in the repo. It never means "broken".
 */
export interface IdentityImage {
  /** Cloudinary का मूल पता, बिना transform के / the untransformed original. */
  url: string;
  alt: string;
  /** मूल नाप / the original's dimensions, when the CMS recorded them. */
  width?: number;
  height?: number;
}

export interface Identity {
  /** पूरा नाम — home पर दो जगह दिखता है / shown twice on the homepage. */
  byline: string;
  role: string;
  bio: string;
  signature: string;
  portraitCaption: string;
  portraitDatestamp: string;
  handle: string;
  /** नीचे की पट्टी में / footer. Derived from `byline` unless overridden. */
  copyright: string;
  /** ऊपर की बड़ी तस्वीर / the full-bleed hero background. */
  heroImage: IdentityImage | null;
  /** पोलरॉइड वाली तस्वीर / the polaroid portrait. */
  portraitImage: IdentityImage | null;
  /**
   * रचना के शीर्षक के नीचे वाली गोल तस्वीर / the round byline photo.
   * `avatarImage` न चढ़ाई हो तो पोलरॉइड वाली ही आती है — ढीली कटी तस्वीर भी
   * ख़ाली गोले से बेहतर है. Falls back to the portrait: a loosely cropped face
   * still beats an empty circle.
   */
  avatarImage: IdentityImage | null;
}

/**
 * CMS से आने वाला आकार / the shape Payload returns. हर खाना ग़ैर-ज़रूरी है —
 * global कभी save न हुआ हो तो Payload डिफ़ॉल्ट लौटाता है, और खाली text field
 * `''` या `null` आता है।
 *
 * Every field is optional: an unsaved global returns defaults, and a cleared
 * text field arrives as `''` or `null`. Both must fall back, not print blank.
 */
interface CmsUpload {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

interface CmsIdentity {
  byline?: string | null;
  role?: string | null;
  bio?: string | null;
  signature?: string | null;
  portraitCaption?: string | null;
  portraitDatestamp?: string | null;
  handle?: string | null;
  copyright?: string | null;
  /**
   * depth=1 पर पूरा object आता है; कभी सिर्फ़ id (number) आए तो तस्वीर नहीं है
   * — यानी वही हाल जो कुछ न चढ़ाने का है।
   * Populated at depth=1. A bare id means the caller asked for too little
   * depth, which is handled the same as "nothing uploaded" rather than crashing.
   */
  heroImage?: CmsUpload | number | null;
  portraitImage?: CmsUpload | number | null;
  avatarImage?: CmsUpload | number | null;
}

/**
 * ⚠️ ये सिर्फ़ आख़िरी सहारा हैं / these are the last resort, not the source.
 * The CMS is the source of truth. These keep the site rendering a real name
 * rather than an empty heading if the identity global is somehow unreadable.
 */
const FALLBACK = {
  byline: site.byline,
  role: site.role,
  /**
   * ⚠️ बायो का सहारा जान-बूझकर ख़ाली है / the bio fallback is deliberately empty.
   *
   * `site.bio` में निर्देश लिखे हैं ("यहाँ अपने बारे में दो-तीन पंक्तियाँ
   * लिखिए…") — वे लेखक के लिए हैं, पाठक के लिए नहीं। उसे सहारा बनाते ही वह
   * production में छप गया और होम पन्ने पर पढ़ने को मिलने लगा।
   *
   * `site.bio` holds instructions addressed to the author, not prose addressed
   * to a reader. Using it as the fallback published those instructions on the
   * live homepage. An empty bio renders nothing at all, which is quiet and
   * correct; instruction text is neither. See Hero.astro, which omits the
   * paragraph entirely when this is blank.
   */
  bio: '',
  signature: site.signature,
  portraitCaption: site.portraitCaption,
  portraitDatestamp: site.portraitDatestamp,
  handle: site.handle,
} as const;

/** खाली को खाली ही मानिए / treat blank and whitespace-only as absent. */
function pick(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * चढ़ाई हुई तस्वीर को साफ़ आकार में / normalise an upload, or report its absence.
 *
 * बिना `url` वाली पंक्ति को "है ही नहीं" माना जाता है। चढ़ाना अधूरा रह गया हो तो
 * होम पन्ने पर टूटी तस्वीर दिखाने से अच्छा है पुरानी वाली दिखाना।
 *
 * A row without a `url` counts as absent. If an upload half-failed, falling
 * back to the bundled picture is better than a broken frame on the homepage —
 * the same reasoning that makes the gallery skip url-less rows.
 */
function image(value: CmsUpload | number | null | undefined): IdentityImage | null {
  if (!value || typeof value !== 'object') return null;
  const url = value.url?.trim();
  if (!url) return null;

  return {
    url,
    alt: value.alt?.trim() ?? '',
    width: value.width ?? undefined,
    height: value.height ?? undefined,
  };
}

async function fetchIdentity(): Promise<Identity> {
  // depth=1 इसलिए कि दोनों तस्वीरें पूरी आएँ — config में defaultDepth 0 है.
  // depth=1 because `defaultDepth` is 0 project-wide; without it both uploads
  // arrive as bare ids and the homepage silently keeps the bundled pictures.
  const url = `${CMS_URL}/api/globals/identity?depth=1`;

  let doc: CmsIdentity = {};

  try {
    const response = await fetch(url);
    if (response.ok) {
      doc = (await response.json()) as CmsIdentity;
    } else {
      console.warn(`[identity] CMS returned HTTP ${response.status} — using the built-in values.`);
    }
  } catch {
    /**
     * यहाँ build रोकना ग़लत होगा / failing the build here would be wrong.
     *
     * रचनाएँ न मिलें तो build रुकना ही चाहिए — खाली साइट छापने से अच्छा है।
     * पर परिचय न मिले तो सिर्फ़ नाम पुराना दिखेगा, साइट पूरी की पूरी ठीक रहेगी।
     *
     * utils/posts.ts throws when the CMS is unreachable, and should: publishing
     * a site with no poems is worse than not publishing. This is the opposite
     * case — the only loss is a possibly stale name, so the build carries on.
     */
    console.warn(`[identity] could not reach the CMS at ${CMS_URL} — using the built-in values.`);
  }

  const byline = pick(doc.byline, FALLBACK.byline);

  return {
    byline,
    role: pick(doc.role, FALLBACK.role),
    bio: pick(doc.bio, FALLBACK.bio),
    signature: pick(doc.signature, FALLBACK.signature),
    portraitCaption: pick(doc.portraitCaption, FALLBACK.portraitCaption),
    portraitDatestamp: pick(doc.portraitDatestamp, FALLBACK.portraitDatestamp),
    handle: pick(doc.handle, FALLBACK.handle),
    /**
     * copyright अपने आप नाम से बनता है / derived from the name by default.
     * यही पूरी बात है: नाम एक जगह बदलिए, पट्टी भी बदल जाए। CMS में कुछ और
     * लिखा हो तभी वह जीतता है.
     *
     * This is the whole point of the feature: change the name in one place and
     * the footer follows. An explicit value in the CMS still wins.
     */
    copyright: pick(doc.copyright, `© ${byline}`),
    heroImage: image(doc.heroImage),
    portraitImage: image(doc.portraitImage),
    avatarImage: image(doc.avatarImage) ?? image(doc.portraitImage),
  };
}

/**
 * एक ही बार पूछिए — पर सिर्फ़ build के समय.
 * Fetch once per build. Hero and SiteFooter both ask, and the footer is on
 * every page, so without this a large site would issue one request per page.
 *
 * dev में हर बार ताज़ा / dev always refetches: the module stays loaded between
 * requests, so a cached copy would keep showing the old name after an edit
 * until the dev server restarted. Same reasoning as utils/posts.ts.
 */
let cache: Promise<Identity> | null = null;

export async function getIdentity(): Promise<Identity> {
  if (import.meta.env.DEV) return fetchIdentity();

  cache ??= fetchIdentity();
  return cache;
}
