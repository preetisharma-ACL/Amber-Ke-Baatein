/** जाँच / debug helper: print the Lexical node tree of a migrated post. */
import { getPayload } from 'payload'

import config from '../payload.config'

const payload = await getPayload({ config })

const { docs } = await payload.find({
  collection: 'posts',
  where: { slug: { equals: process.argv[2] ?? 'kuch-paya-kuch-chhoot-gaya' } },
  limit: 1,
  overrideAccess: true,
  draft: true,
})

if (!docs.length) {
  console.log('no such post')
  process.exit(1)
}

type Node = {
  type?: string
  tag?: string
  text?: string
  format?: unknown
  fields?: Record<string, unknown>
  children?: Node[]
}
const root = (docs[0].content as { root: Node }).root

let i = 0
for (const node of root.children ?? []) {
  const fmt = node.format ? `format=${JSON.stringify(node.format)}` : ''
  console.log(`${String(i++).padStart(2)}  ${(node.type ?? '?').padEnd(10)} ${fmt}`)

  if (node.type === 'block') {
    const text = String(node.fields?.text ?? '')
    console.log(`      blockType=${node.fields?.blockType}`)
    for (const line of text.split('\n')) console.log(`      | ${line}`)
  } else {
    const preview = (node.children ?? [])
      .map((c) => (c.type === 'linebreak' ? ' ⏎ ' : (c.text ?? `<${c.type}>`)))
      .join('')
    if (preview) console.log(`      ${preview.slice(0, 100)}`)
  }
}
process.exit(0)
