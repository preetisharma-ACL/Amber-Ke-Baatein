import type { GlobalConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { revalidateGlobal } from '../hooks/revalidate-site'

/**
 * लेखक का परिचय / the author's identity, as the site shows it.
 *
 * ── यह collection क्यों नहीं है / why a global, not a collection ─────────────
 * लेखक एक ही है। collection बनाने का मतलब होता कि निदेशक जी "नया परिचय जोड़िए"
 * देखें और सोचें कि कौन-सा दिख रहा है। global में एक ही खाना है, एक ही Save.
 *
 * There is exactly one author. A collection would show an "add new" button and
 * a list, leaving the publisher to wonder which row the site is using. A global
 * is a single form with a single Save — which is what this actually is.
 *
 * ── नाम तीन जगह दिखता था, तीनों code में गड़े थे ──────────────────────────────
 * होम पन्ने पर नाम दो बार आता है (बाईं ओर hand-written byline, और तस्वीर के नीचे
 * शीर्षक), दस्तख़त एक बार, और नीचे की पट्टी में copyright में फिर एक बार। पहले ये
 * चारों `apps/web/src/data/site.ts` में लिखे थे — नाम बदलने के लिए code बदलना
 * पड़ता, जो निदेशक जी के बस का नहीं।
 *
 * The name appeared in four places (hero byline, portrait heading, signature,
 * footer copyright), all hardcoded in the Astro source. Changing it meant
 * editing code and redeploying — out of reach of the person whose name it is.
 * Now it is typed here once and every one of those places follows.
 *
 * ── साइट स्थिर है, इसलिए Save पर दोबारा बनती है / the site is static ─────────
 * Save करते ही वही rebuild चलता है जो नई रचना छापने पर चलता है. Saving triggers
 * the same rebuild that publishing a post does — see hooks/revalidate-site.ts.
 * Without that, a changed name would sit in the database and never reach a
 * reader.
 */
export const SiteIdentity: GlobalConfig = {
  slug: 'identity',
  label: 'परिचय / Identity',
  admin: {
    group: 'व्यवस्था / Settings',
    description:
      'होम पन्ने पर दिखने वाला परिचय — नाम, भूमिका, दो पंक्तियाँ अपने बारे में, और दस्तख़त। Save करते ही साइट दोबारा बन जाती है।',
  },
  access: {
    // साइट बिना लॉगिन के build होती है, इसलिए पढ़ना खुला है।
    // The static build fetches this unauthenticated, so read must be public.
    // Nothing here is private — every field is printed on the homepage.
    read: isPublic,
    update: isAuthenticated,
  },
  hooks: {
    afterChange: [revalidateGlobal('परिचय / identity')],
  },
  fields: [
    {
      name: 'byline',
      type: 'text',
      required: true,
      defaultValue: 'आलोक कुमार सिंह',
      label: 'पूरा नाम / Full name',
      admin: {
        description:
          'होम पन्ने पर दो जगह दिखता है — बाईं ओर और तस्वीर के नीचे — और नीचे की पट्टी में copyright में भी, अगर वह खाना खाली छोड़ा हो।',
      },
    },
    {
      name: 'role',
      type: 'text',
      defaultValue: 'कवि',
      label: 'भूमिका / Role',
      admin: {
        description: 'नाम के ठीक नीचे, छोटे अक्षरों में — जैसे "कवि"।',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'अपने बारे में / Short bio',
      admin: {
        description:
          'दो-तीन पंक्तियाँ — आप कहाँ के हैं, कब से लिखते हैं, और क्यों। ज़्यादा औपचारिक मत कीजिए।',
      },
    },
    {
      name: 'signature',
      type: 'text',
      defaultValue: 'आलोक',
      label: 'दस्तख़त / Signature',
      admin: {
        description:
          'परिचय के नीचे हाथ की लिखावट वाला दस्तख़त। आमतौर पर सिर्फ़ पहला नाम — पूरा नाम यहाँ भरा तो पंक्ति टूट सकती है।',
      },
    },
    /**
     * ── दोनों तस्वीरें / the two homepage images ─────────────────────────────
     * ये `media` में जाती हैं, `gallery` में नहीं — वरना ये सार्वजनिक गैलरी की
     * जाली में भी आ जातीं, जो रचनाओं की cover तस्वीरों के साथ पहले ही तय हो
     * चुका फ़ैसला है।
     *
     * Both point at `media`, not `gallery`. The gallery collection is what the
     * public /gallery grid renders; a background photograph and a portrait
     * belong to the page's furniture, not to the exhibition. This is the same
     * split that keeps post cover images out of that grid.
     *
     * दोनों वैकल्पिक हैं / both optional: leave either empty and the site keeps
     * using the picture bundled in the repo, exactly as before.
     */
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'ऊपर की बड़ी तस्वीर / Hero background',
      admin: {
        description:
          'होम पन्ने के पीछे पूरी चौड़ाई में दिखने वाली तस्वीर। चौड़ी (landscape) तस्वीर चुनिए — कम से कम 1600px चौड़ी। इसके ऊपर लिखावट आती है, इसलिए साइट इसे थोड़ा गहरा कर देती है। खाली छोड़ेंगे तो पतंगों वाली पुरानी तस्वीर ही रहेगी।',
      },
    },
    {
      name: 'portraitImage',
      type: 'upload',
      relationTo: 'media',
      label: 'अपनी तस्वीर / Portrait',
      admin: {
        description:
          'पोलरॉइड फ़्रेम में दिखने वाली तस्वीर। खड़ी (portrait) तस्वीर सबसे अच्छी लगती है — फ़्रेम 4:5 का है और बाक़ी हिस्सा अपने आप कट जाता है, इसलिए चेहरा बीच में रखिए। खाली छोड़ेंगे तो पुरानी तस्वीर ही रहेगी।',
      },
    },
    {
      name: 'portraitCaption',
      type: 'text',
      defaultValue: 'अपनी गली में',
      label: 'तस्वीर के नीचे / Portrait caption',
      admin: {
        description: 'पोलरॉइड के नीचे हाथ से लिखी-सी पंक्ति।',
      },
    },
    {
      name: 'portraitDatestamp',
      type: 'text',
      defaultValue: "'२६ ०१ ०८",
      label: 'तस्वीर की तारीख़ / Portrait datestamp',
      admin: {
        description:
          'पुराने कैमरे जैसी नारंगी तारीख़, तस्वीर के कोने में। जैसा लिखेंगे वैसा ही छपेगा — यह असली तारीख़ नहीं है, सजावट है।',
      },
    },
    {
      name: 'handle',
      type: 'text',
      defaultValue: '@ambarkibaatein',
      label: 'सोशल हैंडल / Social handle',
      admin: {
        position: 'sidebar',
        description: 'नीचे की पट्टी में दिखता है।',
      },
    },
    {
      name: 'copyright',
      type: 'text',
      label: 'Copyright पंक्ति',
      admin: {
        position: 'sidebar',
        description:
          'खाली छोड़िए — तब "© <पूरा नाम>" अपने आप बन जाता है और नाम बदलने पर साथ ही बदल जाता है। कुछ और लिखना हो तभी भरिए।',
      },
    },
  ],
}
