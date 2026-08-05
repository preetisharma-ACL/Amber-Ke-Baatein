/**
 * असली जाँच / live end-to-end test of the autofill handler.
 *
 * Calls the real endpoint handler with a stubbed request, so everything the
 * browser would trigger runs: the Claude call, the segment classification, slug
 * sanitising + uniqueness, category matching, and Lexical construction.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import { lexicalToHtml } from '@amber/shared'

import { draftFromPoem } from '../endpoints/draft-from-poem'
import config from '../payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// निदेशक जी जैसा चिपकाते — सादा text, कोई HTML नहीं.
// Simulate what the director would actually paste: plain text, no markup.
const raw = await fs.readFile(
  path.resolve(dirname, '../../../web/src/content/posts/kuch-paya-kuch-chhoot-gaya.md'),
  'utf8',
)
// शीर्षक सबसे ऊपर, जैसे निदेशक जी चिपकाते / title line first, as a real paste has.
// Without it the piece is untitled and Claude must invent one from the text —
// a different (and much weaker) test of the transliteration this exists for.
const title = /title:\s*'([^']+)'/.exec(raw)?.[1] ?? ''

const poem = (title ? `${title}\n\n` : '') + raw
  .replace(/^---[\s\S]*?---\n/, '') // drop frontmatter
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/div>|<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

console.log(`\npasting ${poem.length} characters of plain text\n`)
console.log('─'.repeat(60))
console.log(poem.slice(0, 220) + '…')
console.log('─'.repeat(60))

const payload = await getPayload({ config })
const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })

const req = {
  user: users.docs[0],
  payload,
  json: async () => ({ poem }),
} as never

const start = performance.now()
const res = await draftFromPoem.handler(req)
const elapsed = performance.now() - start

const data = (await (res as Response).json()) as Record<string, unknown>

console.log(`\nHTTP ${(res as Response).status}   ${(elapsed / 1000).toFixed(1)}s\n`)

if ((res as Response).status !== 200) {
  console.log('FAILED:', data)
  process.exit(1)
}

console.log('── filled fields ──────────────────────────────────────')
console.log(`  शीर्षक / title    : ${data.title}`)
console.log(`  पता / slug        : ${data.slug}`)
console.log(`  श्रेणी / category  : ${data.categoryName ?? '(none matched)'}`)
console.log(`  तारीख़ / date      : ${data.displayDate}`)
console.log(`  क्रम / order       : ${data.order}`)
console.log(`  झलक / excerpt     : ${String(data.excerpt).slice(0, 90)}…`)
console.log(`  segments          : ${JSON.stringify(data.summary)}`)

console.log('\n── slug accuracy ──────────────────────────────────────')
const expectedSlug = 'kuch-paya-kuch-chhoot-gaya'
/**
 * -2 हटाकर तुलना कीजिए / strip the uniqueness suffix before comparing.
 * The post being pasted already exists, so the endpoint correctly appends -2.
 * Comparing the raw string calls a perfect transliteration a miss.
 */
const bare = String(data.slug).replace(/-\d+$/, '')
console.log(`  hand-picked      : ${expectedSlug}`)
console.log(`  Claude           : ${bare}`)
console.log(`  stored as        : ${data.slug}${bare !== data.slug ? '  (suffix added — slug already taken)' : ''}`)
console.log(`  ${bare === expectedSlug ? 'EXACT MATCH' : 'differs — still a readable roman slug, just a different choice'}`)

console.log('\n── rendered body ──────────────────────────────────────')
const html = lexicalToHtml(data.content as never)
console.log(html.replace(/></g, '>\n<').slice(0, 1400))

console.log('\n── structure ──────────────────────────────────────────')
for (const cls of ['verse', 'stanza', 'lyric', 'center']) {
  console.log(`  ${cls.padEnd(8)} ${(html.match(new RegExp(`class="${cls}"`, 'g')) || []).length}`)
}

process.exit(0)
