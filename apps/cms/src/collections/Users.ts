import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminField, isAdminOrSelf } from '../access'

/**
 * CMS में लॉगिन करने वाले लोग / people who can sign into the admin panel.
 * These are staff accounts, not site visitors — commenters are never users.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'व्यवस्था',
  },
  auth: true,
  access: {
    // नया खाता सिर्फ़ admin बना सकता है — वरना कोई भी खुद को जोड़ लेगा।
    // Only admins create accounts. Without this, Payload allows the first
    // route to self-registration and anyone could add themselves.
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'नाम',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      label: 'भूमिका',
      options: [
        { label: 'Admin — पूरा नियंत्रण', value: 'admin' },
        { label: 'Editor — रचनाएँ लिख/छाप सकते हैं', value: 'editor' },
      ],
      access: {
        // कोई खुद को admin न बना ले / stops an editor promoting themselves.
        create: isAdminField,
        update: isAdminField,
      },
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
