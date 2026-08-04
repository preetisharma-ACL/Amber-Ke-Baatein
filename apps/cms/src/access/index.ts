import type { Access, FieldAccess } from 'payload'

/**
 * कौन क्या कर सकता है / who can do what.
 *
 * दो भूमिकाएँ हैं: `admin` (आप) और `editor` (निदेशक जी — सिर्फ़ लिखते हैं)।
 * Two roles: `admin` (you — full control, manages users) and `editor` (the
 * director — writes and publishes posts, moderates comments, but cannot add
 * users or delete other people's accounts).
 */

/** लॉगिन किया हुआ कोई भी / any signed-in CMS user. */
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isAuthenticatedField: FieldAccess = ({ req: { user } }) => Boolean(user)

/** सिर्फ़ admin / admins only. */
export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const isAdminField: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

/** admin, या अपना ही record / admins, or the user acting on their own record. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

/** सबके लिए खुला / open to the world, no login needed. */
export const isPublic: Access = () => true
