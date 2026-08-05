import type { CollectionConfig } from 'payload'

import { isAuthenticated, isPublic } from '../access'
import { slugField } from '../fields/slug'

/**
 * श्रेणियाँ / categories — "संस्मरण", "कविता", "मार्गदर्शन".
 *
 * पहले यह हर रचना के frontmatter में सिर्फ़ एक string थी; अब अपनी table है,
 * ताकि नाम बदलने पर हर रचना अपने-आप बदल जाए।
 * These used to be a bare string repeated in every post's frontmatter.
 * As a real table, renaming a category updates every post at once, and a typo
 * can no longer silently create a second category.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'श्रेणी / Category', plural: 'श्रेणियाँ / Categories' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'सामग्री / Content',
  },
  access: {
    read: isPublic,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: 'नाम / Name',
      admin: {
        description: 'जैसे: संस्मरण, कविता, मार्गदर्शन',
      },
    },
    slugField('पते में यही आता है — /category/kavita'),
    {
      name: 'description',
      type: 'textarea',
      label: 'परिचय / Description (वैकल्पिक)',
      admin: {
        description: 'श्रेणी के पन्ने पर ऊपर दिखेगा।',
      },
    },
  ],
}
