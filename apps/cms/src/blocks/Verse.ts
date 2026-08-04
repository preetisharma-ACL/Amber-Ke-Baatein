import type { Block } from 'payload'

/**
 * कविता का बंद / a poem block.
 *
 * पुरानी markdown में यह `<div class="verse">` था — निदेशक जी से HTML लिखवाना
 * ठीक नहीं, इसलिए अब यह editor में एक बटन है।
 *
 * The old markdown expressed poems as raw `<div class="verse"><div class="stanza">`
 * HTML. Lexical has no raw-HTML node, and asking a non-technical author to type
 * div tags is not reasonable — so poems become a first-class block instead.
 *
 * लिखने का तरीक़ा / how it is authored: plain text, one line per line of verse,
 * एक खाली पंक्ति = नया बंद. The site turns blank-line-separated groups into the
 * `.stanza` divs and single newlines into `<br>`, which reproduces the original
 * markup exactly — so the existing CSS keeps working untouched.
 */
export const VerseBlock: Block = {
  slug: 'verse',
  labels: { singular: 'कविता', plural: 'कविताएँ' },
  fields: [
    {
      name: 'text',
      type: 'textarea',
      required: true,
      label: 'कविता',
      admin: {
        rows: 10,
        description:
          'जैसी लिखनी है वैसी ही लिखिए। हर बंद के बीच एक खाली पंक्ति छोड़ दीजिए — बाकी अपने आप हो जाएगा।',
      },
    },
  ],
}
