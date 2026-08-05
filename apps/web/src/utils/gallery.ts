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
export async function getGallery(): Promise<GalleryPhoto[]> {
  const url = `${CMS_URL}/api/gallery?depth=0&limit=200&sort=-order`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(
      `गैलरी नहीं मिली / could not reach the CMS at ${CMS_URL}.\n` +
        `Start it with "npm run dev:cms" (it must be running to build the site).`,
      { cause }
    );
  }

  if (!response.ok) {
    throw new Error(`CMS returned HTTP ${response.status} for ${url}`);
  }

  const body = (await response.json()) as { docs: CmsGalleryDoc[] };

  return body.docs
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
