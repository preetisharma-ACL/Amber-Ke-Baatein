import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * `name` और `role` इसलिए हैं क्योंकि Users में ये ज़रूरी हैं.
 * Both are required on the Users collection, so the scaffolded seed data no
 * longer type-checks without them — TypeScript otherwise falls through to
 * payload.create's draft overload and reports a confusing "missing draft".
 */
export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  name: 'Test User',
  role: 'admin' as const,
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
