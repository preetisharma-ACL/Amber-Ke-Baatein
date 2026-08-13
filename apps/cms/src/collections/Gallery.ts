import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate-site'

/**
 * गैलरी की तस्वीरें / the photographs on the गैलरी page.
 *
 * ── Media से अलग क्यों / why this is not just Media ──────────────────────────
 * Media में रचनाओं की मुख्य तस्वीरें, banner और होम पन्ने की तस्वीरें भी रहती हैं
 * — वे सब गैलरी में नहीं दिखनी चाहिए। अलग collection रखने से "जो यहाँ है वही
 * गैलरी में है" — कोई छिपा हुआ नियम नहीं।
 *
 * Media also holds post covers, banners and the homepage pictures, and those
 * should not all appear in the gallery. Keeping them apart means what is in
 * this collection is exactly what the page shows — nothing surprising turns up
 * in the grid.
 *
 * ── एक पंक्ति, दो रास्ते / one row, two ways to fill it ──────────────────────
 * हर पंक्ति में या तो अपनी नई फ़ाइल चढ़ती है, या `mediaImage` से पहले से चढ़ी हुई
 * तस्वीर चुनी जाती है। दूसरा रास्ता इसलिए है कि जो तस्वीर पहले से Media में है
 * (मान लीजिए किसी रचना की मुख्य तस्वीर), उसे गैलरी में दिखाने के लिए दोबारा
 * चढ़ाना पड़ता था — यानी Cloudinary पर वही फ़ाइल दो बार।
 *
 * A row carries either its own upload or a pick from `media`. The second path
 * exists because showing an already-uploaded picture in the gallery previously
 * meant uploading it a second time — the same file twice on Cloudinary, and two
 * rows to keep in step if the caption ever changed.
 *
 * इसीलिए `filesRequiredOnCreate: false` — बिना फ़ाइल वाली पंक्ति बन सके. नीचे
 * वाला hook यह पक्का करता है कि दोनों में से एक तो ज़रूर हो.
 * Hence `filesRequiredOnCreate: false`, so a row can exist with no file of its
 * own; the hook below is what stops it from having neither.
 *
 * ── आकार यहाँ नहीं बनते / no imageSizes here ─────────────────────────────────
 * Cloudinary माँगने पर आकार बदल देता है, इसलिए सिर्फ़ मूल तस्वीर जाती है।
 * Cloudinary resizes on demand from the URL, so only the original is uploaded.
 * See lib/cloudinary-adapter.ts.
 */

/**
 * दोनों में से एक तो हो / a row must end up with a picture, one way or another.
 *
 * `filesRequiredOnCreate: false` फ़ाइल की शर्त हटा देता है, इसलिए शर्त यहाँ लगती
 * है। बिना इसके एक ऐसी पंक्ति बन सकती थी जो admin में तो दिखे पर साइट पर कभी न
 * आए — और उसका कोई सन्देश भी न मिले, क्योंकि साइट बेकार पंक्तियाँ चुपचाप छोड़
 * देती है। चुपचाप ग़ायब होने से बेहतर है साफ़-साफ़ मना कर देना।
 *
 * Turning the file requirement off means the requirement has to move here.
 * Without it the author could save a row that shows in the admin and never
 * reaches the site — with no feedback at all, since the site skips unusable
 * rows silently. Refusing plainly beats vanishing quietly.
 */
const requireAPicture: CollectionBeforeValidateHook = ({ data, originalDoc, req }) => {
  /**
   * ⚠️ `data.mediaImage ?? originalDoc.mediaImage` यहाँ ग़लत होता / would be wrong.
   * तस्वीर हटाने पर `data.mediaImage` `null` आता है, और `??` उसे "कुछ नहीं कहा"
   * समझकर पुरानी क़ीमत लौटा देता — यानी हटाना कभी पकड़ा ही नहीं जाता।
   * Clearing the pick sends an explicit `null`, which `??` would read as "not
   * mentioned" and fall back to the old value — so a clear would never be
   * caught. The key has to be tested, not the value.
   */
  const picked =
    data && 'mediaImage' in data ? data.mediaImage : (originalDoc?.mediaImage ?? null)

  const hasOwnFile = Boolean(req?.file) || Boolean(data?.filename ?? originalDoc?.filename)

  if (!hasOwnFile && !picked) {
    throw new APIError(
      'तस्वीर चुनिए — या तो नई फ़ाइल चढ़ाइए, या "पहले से चढ़ी हुई तस्वीर" में से एक चुनिए। / A gallery row needs either its own upload or a picture chosen from Media.',
      400
    )
  }

  return data
}
export const Gallery: CollectionConfig = {
  slug: 'gallery',
  labels: { singular: 'गैलरी तस्वीर / Gallery photo', plural: 'गैलरी / Gallery' },
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['caption', 'order', 'updatedAt'],
    group: 'सामग्री / Content',
    description:
      'गैलरी वाले पन्ने की तस्वीरें। यहाँ जो जोड़ेंगे सिर्फ़ वही साइट पर दिखेगा। नई फ़ाइल चढ़ाइए, या "पहले से चढ़ी हुई तस्वीर" में से चुन लीजिए। क्रम बदलना हो तो नीचे का नंबर बदलिए।',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  // तस्वीर जोड़ते-हटाते ही साइट दोबारा बने / rebuild the site on any change.
  hooks: {
    beforeValidate: [requireAPicture],
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  upload: {
    mimeTypes: ['image/*'],
    // कोई imageSizes नहीं — ऊपर वाली टिप्पणी देखिए.
    focalPoint: true,
    // फ़ाइल ज़रूरी नहीं — पंक्ति `mediaImage` से भी बन सकती है. देखिए ऊपर का hook.
    filesRequiredOnCreate: false,
  },
  fields: [
    {
      /**
       * पहले से चढ़ी हुई तस्वीर / a picture already in Media.
       *
       * upload field होने से admin में "Choose from existing" का बटन अपने आप आता
       * है — यही वह चीज़ है जो माँगी गई थी. नई फ़ाइल भी यहीं से चढ़ाई जा सकती है,
       * और वह Media में जाकर बैठती है, गैलरी में नहीं.
       *
       * An upload field gives the admin its own "Choose from existing" browser,
       * which is the point of this field. A new file can also be uploaded
       * through it, in which case it lands in Media rather than here.
       */
      name: 'mediaImage',
      type: 'upload',
      relationTo: 'media',
      label: 'पहले से चढ़ी हुई तस्वीर / Choose from Media (वैकल्पिक)',
      admin: {
        description:
          'जो तस्वीर पहले से "तस्वीरें / Media" में है उसे यहाँ चुन लीजिए — दोबारा चढ़ाने की ज़रूरत नहीं। अगर आप ऊपर नई फ़ाइल चढ़ा रहे हैं तो इसे खाली छोड़ दीजिए। दोनों भरे हों तो ऊपर वाली फ़ाइल ही दिखेगी।',
      },
    },
    {
      name: 'caption',
      type: 'text',
      required: true,
      label: 'कैप्शन / Caption',
      admin: {
        description: 'तस्वीर के नीचे हाथ की लिखावट में दिखेगा — जैसे "अपनी गली में"।',
      },
    },
    {
      /**
       * ज़रूरी नहीं रखा गया / no longer required, on purpose.
       *
       * पहले से चढ़ी हुई तस्वीर चुनने पर उसका अपना alt पहले ही लिखा जा चुका होता
       * है (Media में वह ज़रूरी है) — वही बात दोबारा लिखवाना उसी जानकारी की दूसरी
       * नक़ल बनाना है, और दो नक़लें हमेशा किसी दिन अलग हो जाती हैं.
       *
       * A picture chosen from Media already carries an alt, since Media
       * requires one. Asking for it again would make a second copy of the same
       * sentence, and two copies always drift apart eventually.
       *
       * खाली छोड़ने पर साइट चुनी हुई तस्वीर का alt लेती है, और वह भी न हो तो
       * कैप्शन — जो ज़रूरी है, इसलिए alt कभी ख़ाली नहीं रहता.
       * Left empty the site uses the chosen picture's own alt, and failing that
       * the caption, which is required — so the alt is never actually empty.
       */
      name: 'alt',
      type: 'text',
      label: 'Alt text / तस्वीर में क्या है',
      admin: {
        description:
          'स्क्रीन-रीडर इसे पढ़ते हैं और तस्वीर न खुलने पर यही दिखता है। पहले से चढ़ी हुई तस्वीर चुनी है तो खाली छोड़ सकते हैं — उसका अपना विवरण इस्तेमाल हो जाएगा।',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
      label: 'क्रम / Sort order',
      admin: {
        position: 'sidebar',
        description: 'बड़ा नंबर पहले दिखता है। सामान्यतः 0 ही रहने दीजिए।',
      },
    },
  ],
}
