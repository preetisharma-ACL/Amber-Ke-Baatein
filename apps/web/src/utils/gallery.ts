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

/**
 * `media` की चुनी हुई पंक्ति / a picture picked from Media.
 * `depth=1` पर पूरी आती है; सिर्फ़ id आए तो कुछ चुना ही नहीं गया माना जाता है।
 * Populated at depth=1; a bare id is treated as "nothing was picked".
 */
interface CmsMediaDoc {
  id: number;
  alt?: string | null;
  url?: string;
  width?: number;
  height?: number;
}

interface CmsGalleryDoc {
  id: number;
  caption: string;
  alt?: string | null;
  url?: string;
  width?: number;
  height?: number;
  order?: number;
  createdAt?: string;
  /** पहले से चढ़ी हुई तस्वीर, अगर चुनी गई हो / the pick from Media, if any. */
  mediaImage?: CmsMediaDoc | number | null;
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
async function fetchCollection<T>(
  slug: string,
  label: string,
  sort = '-order',
  /**
   * जुड़ी हुई पंक्तियाँ चाहिए या नहीं / whether related rows must come populated.
   * `defaultDepth` पूरे project में 0 है (देखिए CLAUDE.md — हर स्तर एक और round
   * trip है), इसलिए जिसे जुड़ाव चाहिए वह ख़ुद माँगता है.
   * `defaultDepth` is 0 project-wide because each level is another ~280ms round
   * trip, so anything needing a relationship asks for it explicitly.
   */
  depth = 0
): Promise<T[]> {
  const url = `${CMS_URL}/api/${slug}?depth=${depth}&limit=200&sort=${sort}`;

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

/**
 * जाली में सिर्फ़ `gallery` की तस्वीरें / the grid shows the gallery collection.
 *
 * ── एक बार यह `media` को भी पढ़ता था / this briefly read `media` too ──────────
 * तर्क यह था कि "तस्वीरें / Media" में चढ़ाई गई तस्वीर कहीं दिखती ही नहीं, और
 * चढ़ाकर कुछ न दिखना उलझन पैदा करता है। पर `media` वह जगह है जहाँ हर तरह की
 * तस्वीर जमा होती है — रचनाओं की मुख्य तस्वीरें, banner, होम पन्ने की तस्वीरें —
 * यानी उसे पढ़ने का मतलब था कि पन्ने की सजावट भी सार्वजनिक जाली में आ जाए, और
 * उसे रोकने का एक ही रास्ता बचे: तस्वीर को `media` से हटा देना, जहाँ वह किसी
 * रचना के काम आ रही है।
 *
 * The reasoning was that a picture uploaded to Media appeared nowhere, and
 * uploading into silence is confusing. But Media is where *every* kind of
 * picture accumulates — post covers, banners, the homepage furniture — so
 * reading it put page furniture into a public exhibition, and the only way to
 * take something out was to delete it from Media, where a post was using it.
 *
 * अब उलझन का हल उलटी दिशा से आता है: गैलरी की पंक्ति ख़ुद `media` में से तस्वीर
 * चुन सकती है (`mediaImage`), इसलिए दोबारा चढ़ाने की ज़रूरत भी नहीं और यह भी तय
 * रहता है कि जाली में सिर्फ़ वही है जो जान-बूझकर वहाँ रखा गया।
 *
 * The confusion is now answered from the other end: a gallery row can point at
 * a picture already in Media, so nothing needs uploading twice — and the grid
 * still contains only what was deliberately put there.
 */
export async function getGallery(): Promise<GalleryPhoto[]> {
  // depth=1 इसलिए कि चुनी हुई तस्वीर पूरी आए, सिर्फ़ id नहीं.
  // depth=1 so a picked picture arrives populated rather than as a bare id.
  const docs = await fetchCollection<CmsGalleryDoc>('gallery', 'गैलरी', '-order', 1);

  /* क्रम लगाने भर के लिए दो और खाने / two extra fields, carried only far enough
     to sort by and then dropped. */
  type Sortable = GalleryPhoto & { order: number; createdAt: string };

  return (
    docs
      .map((doc): Sortable | null => {
        const picked = doc.mediaImage && typeof doc.mediaImage === 'object' ? doc.mediaImage : null;

        /**
         * अपनी फ़ाइल पहले, फिर चुनी हुई / the row's own file wins.
         * दोनों भर देने पर कोई एक तो चुनना ही था; जो इसी पंक्ति के साथ चढ़ी है वह
         * ज़्यादा नई और ज़्यादा जान-बूझकर की गई पसंद है.
         * Something had to win when both are filled, and the file uploaded onto
         * this row is the more recent and more deliberate of the two.
         */
        const url = doc.url?.trim() || picked?.url?.trim() || '';

        // बिना तस्वीर वाली पंक्ति छोड़ दीजिए / skip a row with no usable picture,
        // rather than rendering a broken frame on a page that is only pictures.
        if (!url) return null;

        return {
          id: doc.id,
          caption: doc.caption,
          /**
           * alt यहाँ ज़रूरी नहीं है — पहले चुनी हुई तस्वीर का अपना विवरण, फिर
           * कैप्शन, जो ज़रूरी है. इसलिए यह कभी ख़ाली नहीं जाता.
           * `alt` is optional on a gallery row: the picked picture's own
           * description stands in, and failing that the caption, which is
           * required — so this is never empty.
           */
          alt: doc.alt?.trim() || picked?.alt?.trim() || doc.caption,
          url,
          width: doc.width ?? picked?.width,
          height: doc.height ?? picked?.height,
          order: doc.order ?? 0,
          createdAt: doc.createdAt ?? '',
        };
      })
      .filter((photo): photo is Sortable => photo !== null)
      /**
       * हाथ से लगाया क्रम पहले, फिर नई पहले / manual order first, then newest.
       * `id` सबसे आख़िर में, ताकि बराबरी की हालत में क्रम हर build पर एक-सा रहे.
       * `id` last so the order never wobbles between builds on a tie.
       */
      .sort((a, b) => b.order - a.order || b.createdAt.localeCompare(a.createdAt) || a.id - b.id)
      .map(({ order: _order, createdAt: _createdAt, ...photo }) => photo)
  );
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
