/**
 * गैलरी की तस्वीरें CMS से / gallery photos, from the CMS.
 *
 * पहले यह `data/gallery.ts` में हाथ से लिखी सूची थी और तस्वीरें `src/assets/`
 * में पड़ी रहती थीं — यानी हर नई तस्वीर के लिए code बदलना पड़ता था।
 *
 * This replaces a hand-written array in `data/gallery.ts` that imported files
 * from `src/assets/`. Adding a photograph meant editing code, which put it out
 * of reach of the person actually taking the photographs.
 */

const CMS_URL = import.meta.env.PUBLIC_CMS_URL ?? 'http://localhost:3456';

export interface GalleryPhoto {
  id: number;
  /** तस्वीर के नीचे लिखा हुआ / the handwritten line under the print. */
  caption: string;
  alt: string;
  /** Cloudinary का पता, बिना किसी transformation के. */
  url: string;
  width?: number;
  height?: number;
}

interface CmsGalleryDoc {
  id: number;
  caption: string;
  alt: string;
  url?: string;
  width?: number;
  height?: number;
  order?: number;
}

/** आलोक की आवाज़ें / a recording, as the gallery page shows it. */
export interface GalleryRecording {
  id: number;
  title: string;
  /** Cloudinary का पता / the audio file's URL. */
  url: string;
}

/** चलचित्र / a video. फ़ाइल नहीं, सिर्फ़ लिंक — see the Videos collection. */
export interface GalleryVideo {
  id: number;
  title: string;
  /** जैसा चिपकाया गया वैसा ही — पहचान साइट पर होती है / parsed by utils/embeds. */
  videoUrl: string;
}

/**
 * Cloudinary से मनचाहा आकार / ask Cloudinary for a specific rendition.
 *
 * Cloudinary का पता ऐसा होता है:
 *   https://res.cloudinary.com/<cloud>/image/upload/<transform>/<id>.jpg
 * `/upload/` के ठीक बाद जो लिखा जाए, वही तस्वीर पर लागू होता है।
 *
 * A Cloudinary URL carries its transformation in the path, so a size is
 * requested by rewriting the URL rather than by storing a second file. This is
 * the whole reason the CMS no longer pre-generates fixed sizes: one stored URL
 * serves every size the site will ever want.
 *
 * `f_auto` browser के हिसाब से format चुनता है (WebP/AVIF), `q_auto` गुणवत्ता।
 * `f_auto` picks WebP or AVIF per browser and `q_auto` picks a quality level —
 * both meaningful on the phones most of these readers use.
 */
export function cloudinaryVariant(url: string, transform: string): string {
  if (!url.includes('/upload/')) return url; // not a Cloudinary URL — leave it alone
  return url.replace('/upload/', `/upload/${transform}/`);
}

/**
 * सारी तस्वीरें, क्रम से / every photo, in the author's order.
 *
 * बड़ा `order` पहले — रचनाओं की तरह ही.
 * Higher `order` first, matching how posts sort, so there is one rule to
 * remember rather than two.
 */
/**
 * एक collection माँगिए / fetch one collection, in the author's order.
 *
 * तीनों खाने — तस्वीरें, आवाज़ें, चलचित्र — एक ही तरह से माँगे जाते हैं, इसलिए
 * माँगने और ग़लती पकड़ने का काम एक ही जगह रहता है। तीन जगह लिखने का मतलब होता कि
 * CMS बंद होने पर एक खाना साफ़-साफ़ रुकता और दूसरा चुपचाप ख़ाली दिखता।
 *
 * All three tabs are fetched identically, so the request and its error handling
 * live in one place. Written out three times, a stopped CMS would fail loudly
 * for one tab and silently render an empty one for another — and an empty tab
 * looks like "nothing uploaded yet", not like a broken build.
 */
async function fetchCollection<T>(slug: string, label: string): Promise<T[]> {
  const url = `${CMS_URL}/api/${slug}?depth=0&limit=200&sort=-order`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(
      `${label} नहीं मिलीं / could not reach the CMS at ${CMS_URL}.\n` +
        `Start it with "npm run dev:cms" (it must be running to build the site).`,
      { cause }
    );
  }

  if (!response.ok) {
    throw new Error(`CMS returned HTTP ${response.status} for ${url}`);
  }

  return ((await response.json()) as { docs: T[] }).docs;
}

export async function getGallery(): Promise<GalleryPhoto[]> {
  const docs = await fetchCollection<CmsGalleryDoc>('gallery', 'गैलरी');

  return docs
    // बिना फ़ाइल वाली पंक्ति छोड़ दीजिए / skip a row whose upload failed, rather
    // than rendering a broken frame on a page that is entirely pictures.
    .filter((doc) => typeof doc.url === 'string' && doc.url.length > 0)
    .map((doc) => ({
      id: doc.id,
      caption: doc.caption,
      alt: doc.alt,
      url: doc.url!,
      width: doc.width,
      height: doc.height,
    }));
}

/**
 * आलोक की आवाज़ें / every recording, newest-or-highest first.
 *
 * ये वही फ़ाइलें हैं जो रचना के साथ भी लगती हैं — अलग collection नहीं। एक ही
 * पाठ को दो जगह चढ़ाने से बचाने के लिए: जो रचना के साथ लगी है वह यहाँ भी सुनी जा
 * सकती है, और जो किसी रचना से नहीं जुड़ी वह भी।
 *
 * These are the same files that attach to a post — not a second collection.
 * That is deliberate: a recording the author has already uploaded for a poem
 * should not have to be uploaded again to appear here, and a recording that
 * belongs to no particular poem still has somewhere to live.
 */
export async function getRecordings(): Promise<GalleryRecording[]> {
  const docs = await fetchCollection<{ id: number; title: string; url?: string }>(
    'audio',
    'आवाज़ें'
  );

  return docs
    // बिना फ़ाइल वाली पंक्ति छोड़ दीजिए / a row whose upload failed has nothing
    // to play, and an <audio> with no source is a silent dead control.
    .filter((doc) => typeof doc.url === 'string' && doc.url.length > 0)
    .map((doc) => ({ id: doc.id, title: doc.title, url: doc.url! }));
}

/**
 * चलचित्र / every video.
 *
 * यहाँ सिर्फ़ लिंक आता है — किस मंच का है यह `utils/embeds.ts` तय करता है, ठीक
 * वैसे ही जैसे रचना के साथ लगे वीडियो के लिए।
 *
 * Only the link comes through; which platform it belongs to is worked out by
 * `utils/embeds.ts`, exactly as for a video attached to a post. A link the
 * parser does not recognise is dropped by the page rather than rendered as an
 * empty frame.
 */
export async function getVideos(): Promise<GalleryVideo[]> {
  const docs = await fetchCollection<{ id: number; title: string; videoUrl?: string }>(
    'videos',
    'चलचित्र'
  );

  return docs
    .filter((doc) => typeof doc.videoUrl === 'string' && doc.videoUrl.length > 0)
    .map((doc) => ({ id: doc.id, title: doc.title, videoUrl: doc.videoUrl! }));
}
