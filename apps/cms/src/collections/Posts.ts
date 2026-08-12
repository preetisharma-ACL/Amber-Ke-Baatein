import type { Access, CollectionConfig } from 'payload'

import { isAuthenticated } from '../access'
import { getLikes, likePost } from '../endpoints/like-post'
import { slugField } from '../fields/slug'
import { validateVideoUrl } from '../fields/video-url'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate-site'

/**
 * बिना लॉगिन सिर्फ़ छपी हुई रचनाएँ दिखती हैं / drafts stay private.
 *
 * Returning a `Where` clause instead of `false` is what makes drafts work:
 * the public REST API still answers, it just never sees unpublished rows.
 * Signed-in staff get everything so they can preview their own drafts.
 */
const readPublishedOnly: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

/**
 * रचनाएँ / the posts.
 *
 * पुराने markdown frontmatter से आया हुआ ढाँचा, थोड़े सुधार के साथ।
 * Carried over from the old markdown frontmatter, with two changes worth
 * knowing about — see `displayDate` and `order` below.
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  /**
   * हर label दो भाषाओं में / every label carries both scripts.
   * The author reads Hindi; anyone maintaining the code, reading Payload docs
   * or searching the API reads English. Showing both avoids a glossary.
   */
  labels: { singular: 'रचना / Post', plural: 'रचनाएँ / Posts' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'displayDate', '_status'],
    group: 'सामग्री / Content',
    description: 'यहाँ से नई रचना जोड़िए। सहेजने पर "Draft" रहती है — "Publish" दबाने पर ही साइट पर आती है।',
  },
  access: {
    read: readPublishedOnly,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  // "Save Draft" बनाम "Publish" — निदेशक जी अधूरी रचना बिना डर के सहेज सकें।
  // Drafts + version history: the director can save half-written posts safely,
  // and any published version can be restored if something is overwritten.
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  /**
   * छापते ही साइट पर दिखे / publishing should put the post on the site.
   * Without this the author publishes and the post's own page 404s until
   * someone rebuilds. Never blocks the save — see the hook.
   */
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  // /api/posts/:slug/like और /likes — साइट का पसंद वाला बटन इन्हें बुलाता है.
  endpoints: [likePost, getLikes],
  fields: [
    {
      /**
       * सबसे ऊपर का पैनल — कविता चिपकाइए, बाक़ी अपने-आप.
       * A `ui` field stores nothing; it exists purely to mount the autofill
       * panel above the real fields it populates.
       */
      name: 'poemAutofill',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/PoemAutofill#PoemAutofill',
        },
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'शीर्षक / Title',
    },
    slugField('पते में यही आता है — /posts/kuch-paya-kuch-chhoot-gaya'),
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      label: 'झलक / Excerpt',
      maxLength: 300,
      admin: {
        description: 'सूची और कार्ड पर दिखने वाली दो-तीन पंक्तियाँ।',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'रचना / Content',
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      label: 'श्रेणी / Category',
      admin: { position: 'sidebar' },
    },
    {
      /**
       * ऊपर पूरी चौड़ाई में दिखने वाली तस्वीर / the wide banner behind the title.
       *
       * ── यह `coverImage` से अलग क्यों है / why this is not the cover ──────────
       * दोनों का आकार अलग है। cover चौकोर या खड़ी होती है और पढ़ने की चौड़ाई में
       * बैठती है; banner बहुत चौड़ी (लगभग 4:1) होती है और उसके ऊपर शीर्षक छपता
       * है। एक ही तस्वीर से दोनों काम लेने का मतलब है कि खड़ी तस्वीर का चेहरा
       * banner में कट जाए — और कटती हमेशा वही चीज़ है जो सबसे ज़रूरी थी।
       *
       * A cover is portrait or square and sits at the reading measure; a banner
       * is ~4:1 and carries the title over it. Using one image for both means
       * the browser crops a portrait into a letterbox, and what it crops is
       * invariably the face.
       *
       * खाली छोड़ने पर साइट की अपनी बनी-बनाई तस्वीर लगती है
       * (`apps/web/src/assets/poetry-banner.png`). cover यहाँ जान-बूझकर नहीं आती
       * — देखिए `banner` का नोट `apps/web/src/utils/posts.ts` में.
       *
       * Left empty, the site's own banner is used. The cover deliberately does
       * not stand in — see the note on `banner` in apps/web/src/utils/posts.ts.
       */
      name: 'bannerImage',
      type: 'upload',
      relationTo: 'media',
      label: 'ऊपर की चौड़ी तस्वीर / Banner (वैकल्पिक)',
      admin: {
        position: 'sidebar',
        description:
          'रचना के पन्ने पर सबसे ऊपर, पूरी चौड़ाई में दिखती है। बहुत चौड़ी तस्वीर चुनिए — कम से कम 1900px चौड़ी। इसके ऊपर शीर्षक छपता है, इसलिए साइट इसे गहरा कर देती है और ऊपर-नीचे से थोड़ी कट सकती है, तो ज़रूरी हिस्सा बीच में रखिए। खाली छोड़ेंगे तो साइट की अपनी बनी-बनाई तस्वीर लग जाएगी — कुछ टूटेगा नहीं।',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'मुख्य तस्वीर / Cover image (वैकल्पिक)',
      admin: {
        position: 'sidebar',
        description:
          'रचना के साथ लगी तस्वीर। वीडियो चलाने से पहले जो तस्वीर दिखती है, वह भी यही है (जब मंच अपनी तस्वीर न दे, जैसे Instagram)।',
      },
    },
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'audio',
      label: 'आवाज़ / Audio (वैकल्पिक)',
      admin: {
        position: 'sidebar',
        description: 'रचना का पाठ। रचना के बग़ल में सुनने का बटन दिखेगा।',
      },
    },
    {
      /**
       * एक ही खाना, दोनों के लिए / one field for both platforms.
       *
       * अलग-अलग खाने रखने का मतलब होता कि निदेशक जी को चुनना पड़ता कि यह लिंक
       * किस तरह का है — जबकि लिंक ख़ुद बता देता है।
       *
       * A single URL field rather than one per platform: asking the author to
       * classify a link they just copied is asking them to do work the code can
       * do by looking at it. The site detects YouTube vs Instagram from the URL
       * itself — see apps/web/src/utils/embeds.ts.
       */
      name: 'videoUrl',
      type: 'text',
      label: 'वीडियो लिंक / Video link (वैकल्पिक)',
      admin: {
        position: 'sidebar',
        description:
          'YouTube या Instagram reel का लिंक चिपकाइए — जैसा है वैसा ही। रचना के बग़ल में वीडियो दिखेगा।',
      },
      // चलचित्र वाला collection भी यही जाँच लगाता है / the चलचित्र collection uses
      // the same check — see fields/video-url.ts for why it is shared.
      validate: validateVideoUrl,
    },
    {
      /**
       * जैसा लिखा है वैसा ही दिखता है — "1 अगस्त 2026".
       *
       * A plain string on purpose, inherited from the old frontmatter schema.
       * Hindi dates like "1 अगस्त 2026" are not JS-Date-parseable, so this is
       * stored and rendered verbatim. Never sort on it — that is what
       * `publishedAt` and `order` are for.
       */
      name: 'displayDate',
      type: 'text',
      required: true,
      label: 'तारीख़ / Display date (जैसी दिखनी चाहिए)',
      admin: {
        position: 'sidebar',
        description: 'हिन्दी में लिखिए — जैसे "1 अगस्त 2026"। जैसा लिखेंगे वैसा ही दिखेगा।',
      },
    },
    {
      // ऊपर वाली तारीख़ पढ़ने के लिए है; क्रम इससे लगता है।
      // The machine-readable counterpart to displayDate — sorting and RSS use
      // this, readers never see it.
      name: 'publishedAt',
      type: 'date',
      required: true,
      // सूची इसी से छँटती है / list views and the site sort on this.
      // Note: at the current data size this saves nothing measurable — the cost
      // is network round trips, not scanning. It is here so the query stays
      // sane once there are hundreds of posts.
      index: true,
      label: 'असली तारीख़ / Published date (क्रम के लिए)',
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: 'sidebar',
        description: 'सूची का क्रम इसी से तय होता है। पाठकों को यह नहीं दिखती।',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      // हर सूची `sort=-order` करती है / every list query sorts by this.
      index: true,
      label: 'क्रम / Sort order',
      admin: {
        position: 'sidebar',
        description: 'बड़ा नंबर ऊपर दिखता है। सामान्यतः 0 ही रहने दीजिए।',
      },
    },
    {
      // गिनती site की तरफ़ से बढ़ती है, हाथ से नहीं।
      // Incremented by the site's endpoints, never typed in — read-only here so
      // an accidental edit in the admin panel cannot reset the counters.
      name: 'views',
      type: 'number',
      defaultValue: 0,
      label: 'कितनी बार पढ़ी गई / Views',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'likes',
      type: 'number',
      defaultValue: 0,
      label: 'कितने लोगों को पसंद आई / Likes',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
