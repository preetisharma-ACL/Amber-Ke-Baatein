import type { Field } from 'payload'

/**
 * पते वाला हिस्सा / the URL segment, e.g. /posts/kuch-paya-kuch-chhoot-gaya
 *
 * यह अपने-आप नहीं बनता — जान-बूझकर।
 * Deliberately NOT auto-generated. Titles here are Devanagari, and slugifying
 * "कुछ पाया कुछ छूट गया" yields either an empty string or percent-encoded
 * bytes — neither makes a readable URL. The existing posts use hand-picked
 * romanisations ("kuch-paya-kuch-chhoot-gaya"), so the author types it.
 */
export const slugField = (description: string): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  label: 'पता (slug)',
  admin: {
    position: 'sidebar',
    description,
  },
  validate: (value: string | null | undefined) => {
    if (!value) return 'पता ज़रूरी है / a slug is required.'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      return 'सिर्फ़ अंग्रेज़ी के छोटे अक्षर, अंक और बीच में hyphen — जैसे kuch-paya-kuch-chhoot-gaya'
    }
    return true
  },
})
