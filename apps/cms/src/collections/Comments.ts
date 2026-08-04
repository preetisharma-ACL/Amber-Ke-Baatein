import type { Access, CollectionConfig } from 'payload'

import { isAuthenticated, isAuthenticatedField, isPublic } from '../access'

/**
 * बिना लॉगिन सिर्फ़ स्वीकृत टिप्पणियाँ / the public only ever sees approved ones.
 */
const readApprovedOnly: Access = ({ req: { user } }) => {
  if (user) return true
  return { status: { equals: 'approved' } }
}

/**
 * पाठकों की टिप्पणियाँ / reader comments.
 *
 * कोई भी लिख सकता है, पर छपती तभी है जब आप स्वीकार करें।
 * Anyone may submit; nothing appears until a staff member approves it. That
 * ordering is deliberate — an open comment box on a public site collects spam
 * within days, and pre-moderation is the only thing that reliably stops it.
 */
export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    useAsTitle: 'authorName',
    defaultColumns: ['authorName', 'post', 'status', 'createdAt'],
    group: 'सामग्री',
    description: 'नई टिप्पणियाँ "प्रतीक्षा में" रहती हैं। पढ़कर "स्वीकृत" कीजिए, तभी साइट पर दिखेंगी।',
  },
  access: {
    read: readApprovedOnly,
    // पाठक बिना लॉगिन टिप्पणी कर सकते हैं / visitors post without an account.
    create: isPublic,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        // बाहर से आई टिप्पणी हमेशा "प्रतीक्षा में" ही बनेगी।
        // Field-level access already blocks this, but pinning the value here
        // too means a crafted POST with `"status":"approved"` can never slip
        // straight onto the site, whatever changes upstream.
        if (operation === 'create' && !req.user && data) {
          data.status = 'pending'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      index: true,
      label: 'किस रचना पर',
    },
    {
      name: 'authorName',
      type: 'text',
      required: true,
      maxLength: 80,
      label: 'नाम',
    },
    {
      name: 'authorEmail',
      type: 'email',
      label: 'ईमेल',
      access: {
        // पाठक भेज सकते हैं, पर साइट पर कभी नहीं दिखता।
        // Collected so you can reply; never returned to the public API.
        read: isAuthenticatedField,
      },
      admin: {
        description: 'साइट पर कभी नहीं दिखेगा — सिर्फ़ आपके लिए।',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      maxLength: 2000,
      label: 'टिप्पणी',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      label: 'स्थिति',
      options: [
        { label: 'प्रतीक्षा में', value: 'pending' },
        { label: 'स्वीकृत', value: 'approved' },
        { label: 'स्पैम', value: 'spam' },
      ],
      access: {
        // पाठक अपनी टिप्पणी खुद स्वीकृत न कर ले — पर staff (editor भी) कर सके।
        // Blocks a visitor self-approving by posting `status` directly, while
        // still letting the director (role: editor) moderate.
        create: isAuthenticatedField,
        update: isAuthenticatedField,
      },
      admin: { position: 'sidebar' },
    },
  ],
}
