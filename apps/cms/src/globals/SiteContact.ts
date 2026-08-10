import type { GlobalConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { revalidateGlobal } from '../hooks/revalidate-site'

/**
 * संपर्क का पन्ना / the contact page, as the publisher controls it.
 *
 * ── यह क्यों बना / why this exists ──────────────────────────────────────────
 * पहले संपर्क की तीनों पंक्तियाँ — ईमेल, Instagram, YouTube — `apps/web/src/
 * data/site.ts` में लिखी थीं। नया ठिकाना जोड़ना (Facebook, WhatsApp, X, कुछ भी)
 * का मतलब था code बदलना और साइट दोबारा deploy करना — यानी वह काम निदेशक जी के
 * बस का नहीं रहा। अब पंक्तियाँ यहाँ हैं: जोड़िए, हटाइए, क्रम बदलिए, Save।
 *
 * The three contact rows used to be a hardcoded array in the Astro source, so
 * adding a fourth platform meant editing code. They now live here, where the
 * publisher can add, remove and reorder them.
 *
 * ── collection क्यों नहीं / why a global, not a collection ───────────────────
 * यह एक पन्ना है, पंक्तियों का ढेर नहीं। collection बनाने पर हर पंक्ति की अपनी
 * एक "पोस्ट" बनती, क्रम के लिए एक अलग खाना रखना पड़ता, और शीर्षक-उपशीर्षक का
 * कोई घर ही न होता। global में पूरा पन्ना एक ही form है और क्रम पंक्तियों को
 * खींचकर बदल जाता है।
 *
 * This is one page, not a pile of records. As a collection each row would be
 * its own document needing an explicit `order` field, and the page's heading
 * and closing line would have nowhere to live. Here the whole page is one form
 * and the order is drag-and-drop.
 *
 * ── Save करते ही साइट दोबारा बनती है / saving rebuilds the site ──────────────
 * वही रास्ता जो नई रचना छापने का है — hooks/revalidate-site.ts. इसके बिना बदला
 * हुआ पता database में पड़ा रहता और पाठक तक कभी न पहुँचता।
 */
export const SiteContact: GlobalConfig = {
  slug: 'contact',
  label: 'संपर्क / Contact',
  admin: {
    group: 'व्यवस्था / Settings',
    description:
      'संपर्क पन्ने पर जो दिखता है — शीर्षक, ठिकानों की पंक्तियाँ, और नीचे की पंक्ति। Save करते ही साइट दोबारा बन जाती है।',
  },
  access: {
    // साइट बिना लॉगिन के build होती है / the static build fetches this
    // unauthenticated. Nothing here is private — it is a page of public
    // addresses whose entire purpose is being printed for strangers to read.
    read: isPublic,
    update: isAuthenticated,
  },
  hooks: {
    afterChange: [revalidateGlobal('संपर्क / contact')],
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'संपर्क',
      label: 'शीर्षक / Heading',
      admin: {
        description: 'पन्ने के ऊपर बड़े अक्षरों में। खाली छोड़ेंगे तो "संपर्क" ही रहेगा।',
      },
    },
    {
      name: 'subheading',
      type: 'text',
      defaultValue: 'कुछ कहना हो तो',
      label: 'उपशीर्षक / Subheading',
      admin: {
        description: 'शीर्षक के ठीक नीचे की छोटी पंक्ति।',
      },
    },

    /**
     * ── पंक्तियाँ / the rows ─────────────────────────────────────────────────
     * हर पंक्ति एक ठिकाना है: ऊपर छोटे अक्षरों में उसका नाम, नीचे वह पता जिस पर
     * पाठक दबाता है, और चाहें तो उसके नीचे एक बटन।
     *
     * Each row is one destination: a small caps label, the clickable address
     * under it, and optionally a button beneath that.
     *
     * क्रम खींचकर बदलता है / the order is the array's order, changed by
     * dragging. That is why there is no `order` number field here — a number
     * the author has to keep consistent by hand is a worse version of the same
     * thing, and Payload already stores array position.
     */
    {
      name: 'rows',
      type: 'array',
      label: 'संपर्क की पंक्तियाँ / Contact rows',
      labels: { singular: 'पंक्ति', plural: 'पंक्तियाँ' },
      admin: {
        description:
          'जितने ठिकाने चाहें जोड़िए — ईमेल, Instagram, YouTube, Facebook, WhatsApp, कुछ भी। बाईं ओर से खींचकर क्रम बदल सकते हैं। सारी पंक्तियाँ हटा देंगे तो पन्ने पर सिर्फ़ शीर्षक बचेगा।',
        components: {
          // डिब्बा बंद हो तब भी पता चले कि किसका है / so a collapsed row still
          // says which platform it is, instead of "पंक्ति 02".
          // ⚠️ यह रास्ता importMap से हल होता है — बदलने पर
          // `npm run generate:importmap` चलाइए (देखिए payload.config.ts).
          RowLabel: '/components/ContactRowLabel#ContactRowLabel',
        },
      },
      defaultValue: [
        {
          label: 'ईमेल',
          text: 'alok@aajneeti.social',
          href: 'alok@aajneeti.social',
        },
        {
          label: 'Instagram',
          text: '@ambarkibaatein',
          href: 'https://www.instagram.com/ambarkibaatein',
          buttonLabel: 'Follow',
        },
        {
          label: 'YouTube',
          text: '@AmbarkiBaatein',
          href: 'https://www.youtube.com/@AmbarkiBaatein',
          buttonLabel: 'Subscribe',
          buttonHref: 'https://www.youtube.com/@AmbarkiBaatein?sub_confirmation=1',
        },
      ],
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'नाम / Label',
          admin: {
            width: '35%',
            description: 'ऊपर छोटे अक्षरों में — जैसे "ईमेल", "Instagram"।',
          },
        },
        {
          name: 'text',
          type: 'text',
          label: 'जो दिखेगा / Displayed text',
          admin: {
            width: '65%',
            description:
              'पाठक को यही पढ़ने को मिलता है — जैसे "@ambarkibaatein"। खाली छोड़ेंगे तो पता ही दिख जाएगा।',
          },
        },
        {
          name: 'href',
          type: 'text',
          required: true,
          label: 'पता / Link',
          admin: {
            description:
              'पूरा लिंक चिपकाइए — https://www.instagram.com/… । ईमेल हो तो सिर्फ़ पता लिखिए (alok@aajneeti.social), "mailto:" लगाने की ज़रूरत नहीं। फ़ोन के लिए tel:+91… चलेगा।',
          },
          validate: validateContactHref,
        },

        /**
         * ── साथ लगने वाला बटन / the optional button ───────────────────────────
         * दोनों खाने भरने ज़रूरी नहीं। लिखावट भर दी तो पंक्ति के नीचे बटन आ जाता
         * है; दोनों खाली रहे तो कुछ नहीं आता — ईमेल वाली पंक्ति को इसकी ज़रूरत
         * नहीं, पता ख़ुद ही बटन है।
         *
         * Optional on purpose: the email row needs no button, since the address
         * is already the thing you click. A button appears only when a label is
         * typed.
         */
        {
          name: 'buttonLabel',
          type: 'text',
          label: 'बटन की लिखावट / Button label',
          admin: {
            width: '35%',
            description:
              'खाली छोड़िए तो बटन नहीं आएगा। जैसे "Follow", "Subscribe"। ⚠️ बटन ख़ुद फ़ॉलो या subscribe नहीं करता — वह सिर्फ़ वहाँ ले जाता है जहाँ पाठक उनका अपना बटन दबाता है। कोई भी साइट दूसरी साइट की ओर से यह नहीं कर सकती।',
          },
        },
        {
          name: 'buttonHref',
          type: 'text',
          label: 'बटन का पता / Button link',
          admin: {
            width: '65%',
            description:
              'खाली छोड़ेंगे तो बटन ऊपर वाले पते पर ही ले जाएगा। YouTube के लिए लिंक के आख़िर में ?sub_confirmation=1 जोड़ने पर चैनल खुलते ही subscribe की डिबिया सामने आ जाती है।',
          },
          validate: validateContactHref,
        },
      ],
    },

    {
      name: 'note',
      type: 'textarea',
      defaultValue: 'कोई रचना अच्छी लगे तो बता दीजिएगा — लिखने वाले के लिए इतना ही बहुत होता है।',
      label: 'नीचे की पंक्ति / Closing line',
      admin: {
        description: 'डिब्बे के नीचे, हल्के रंग में। खाली छोड़ेंगे तो कुछ नहीं छपेगा।',
      },
    },
  ],
}

/**
 * पते की जाँच / validating a pasted link.
 *
 * ⚠️ जान-बूझकर ढीली — वही रुख़ जो `fields/video-url.ts` का है। यह सिर्फ़ साफ़
 * ग़लतियाँ पकड़ती है (बीच में जगह, अकेला "https://")। असली सफ़ाई साइट पर होती है:
 * `apps/web/src/utils/contact.ts` सादे ईमेल के आगे `mailto:` और बिना scheme वाले
 * पते के आगे `https://` अपने आप लगा देता है।
 *
 * Deliberately loose, the same stance as the video-url validator. It catches
 * only obvious mistakes; the site normalises the rest — bare emails get
 * `mailto:`, schemeless domains get `https://`. Rejecting those here would mean
 * the CMS refusing links the site handles perfectly well, and would force the
 * author to know what a URL scheme is.
 */
function validateContactHref(value: string | null | undefined): true | string {
  if (!value) return true // खाली की शिकायत `required` करता है, यह नहीं.

  const trimmed = value.trim()
  if (/\s/.test(trimmed))
    return 'पते के बीच में जगह (space) नहीं हो सकती / a link cannot contain spaces.'
  if (/^[a-z]+:\/*$/i.test(trimmed))
    return 'यह अधूरा है — पूरा पता चिपकाइए / this is just the scheme; paste the whole link.'

  return true
}
