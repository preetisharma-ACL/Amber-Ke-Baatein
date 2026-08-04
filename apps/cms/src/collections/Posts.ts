import type { Access, CollectionConfig } from 'payload'

import { isAuthenticated } from '../access'
import { slugField } from '../fields/slug'

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
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'displayDate', '_status'],
    group: 'सामग्री',
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
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'शीर्षक',
    },
    slugField('पते में यही आता है — /posts/kuch-paya-kuch-chhoot-gaya'),
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      label: 'झलक',
      maxLength: 300,
      admin: {
        description: 'सूची और कार्ड पर दिखने वाली दो-तीन पंक्तियाँ।',
      },
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'रचना',
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      label: 'श्रेणी',
      admin: { position: 'sidebar' },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'मुख्य तस्वीर (वैकल्पिक)',
      admin: { position: 'sidebar' },
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
      label: 'तारीख़ (जैसी दिखनी चाहिए)',
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
      label: 'असली तारीख़ (क्रम के लिए)',
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
      label: 'क्रम',
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
      label: 'कितनी बार पढ़ी गई',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'likes',
      type: 'number',
      defaultValue: 0,
      label: 'कितने लोगों को पसंद आई',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
