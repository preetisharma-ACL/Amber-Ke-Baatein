/**
 * पुरानी markdown रचनाओं को Neon में लाने की एक-बार चलने वाली script.
 * One-shot importer: apps/web/src/content/posts/*.md  ->  Payload (Neon).
 *
 * चलाइए / run with:
 *   npm run migrate:markdown --workspace @amber/cms
 *
 * दोबारा चलाना सुरक्षित है — slug से पहचानकर update करती है, नक़ल नहीं बनाती.
 * Safe to re-run: posts are matched by slug and updated in place rather than
 * duplicated, so a failed half-migration can simply be run again.
 *
 * ── यह markdown को सीधे Lexical में क्यों बदलती है ──────────────────────────
 * Why this hand-builds Lexical nodes instead of just calling
 * convertMarkdownToLexical on the whole file:
 *
 * These posts embed raw HTML — `<div class="verse">` for poems, `<p class="lyric">`
 * for quoted song lines, `<p class="center">`. Lexical has no raw-HTML node, so
 * feeding that through the markdown converter turns the poems into *visible
 * escaped text* on the page (verified: the reader would literally see
 * `<div class="verse">`). It also silently drops `<br>`, welding two lines of
 * verse into one.
 *
 * So the body is tokenised first: code fences are protected, the three known
 * HTML shapes are converted to real Lexical structures, and only the remaining
 * plain prose goes through the markdown converter.
 */
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import config from '../payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const POSTS_DIR = path.resolve(dirname, '../../../web/src/content/posts')

// ── frontmatter ─────────────────────────────────────────────────────────────

const KNOWN_KEYS = ['date', 'category', 'title', 'excerpt', 'order', 'draft'] as const
type Frontmatter = {
  date: string
  category: string
  title: string
  excerpt: string
  order: number
  draft: boolean
}

/**
 * छोटा पर सख़्त frontmatter parser.
 * A deliberately strict parser: it throws on any key or line it does not
 * recognise rather than guessing, so a typo fails the migration loudly instead
 * of silently dropping a field.
 */
function parseFrontmatter(raw: string, file: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) throw new Error(`${file}: no frontmatter block found`)

  const [, block, body] = match
  const data: Record<string, string | number | boolean> = {}

  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line)
    if (!kv) throw new Error(`${file}: cannot parse frontmatter line: ${line}`)

    const [, key, rawValue] = kv
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      throw new Error(`${file}: unexpected frontmatter key "${key}"`)
    }

    let value: string | number | boolean = rawValue.trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    } else if (value === 'true' || value === 'false') {
      value = value === 'true'
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value)
    }
    data[key] = value
  }

  for (const required of ['date', 'category', 'title', 'excerpt'] as const) {
    if (typeof data[required] !== 'string') {
      throw new Error(`${file}: missing required frontmatter "${required}"`)
    }
  }

  return {
    data: {
      date: data.date as string,
      category: data.category as string,
      title: data.title as string,
      excerpt: data.excerpt as string,
      order: typeof data.order === 'number' ? data.order : 0,
      draft: data.draft === true,
    },
    body: body ?? '',
  }
}

// ── तारीख़ / dates ────────────────────────────────────────────────────────────

const HINDI_MONTHS: Record<string, number> = {
  जनवरी: 0,
  फरवरी: 1,
  'फ़रवरी': 1,
  मार्च: 2,
  अप्रैल: 3,
  मई: 4,
  जून: 5,
  जुलाई: 6,
  अगस्त: 7,
  सितंबर: 8,
  सितम्बर: 8,
  अक्टूबर: 9,
  नवंबर: 10,
  नवम्बर: 10,
  दिसंबर: 11,
  दिसम्बर: 11,
}

/**
 * "1 अगस्त 2026" -> Date; न पहचान पाए तो null.
 * The Hindi string itself is preserved verbatim as `displayDate`. This only
 * derives the sortable `publishedAt`. "आने वाली रचना" is not a date and
 * correctly yields null rather than an invented timestamp.
 */
function parseHindiDate(value: string): Date | null {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(value.trim())
  if (!m) return null
  const [, day, monthName, year] = m
  const month = HINDI_MONTHS[monthName]
  if (month === undefined) return null
  return new Date(Date.UTC(Number(year), month, Number(day)))
}

// ── Lexical node builders ───────────────────────────────────────────────────

type LexNode = Record<string, unknown>

const textNode = (text: string): LexNode => ({
  type: 'text',
  text,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})

const lineBreak = (): LexNode => ({ type: 'linebreak', version: 1 })

/** पंक्तियों के बीच <br> / interleaves real linebreak nodes between lines. */
function linesToChildren(lines: string[]): LexNode[] {
  const children: LexNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) children.push(lineBreak())
    children.push(textNode(line))
  })
  return children
}

const quoteNode = (lines: string[]): LexNode => ({
  type: 'quote',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  children: linesToChildren(lines),
})

const centeredParagraph = (text: string): LexNode => ({
  type: 'paragraph',
  version: 1,
  format: 'center',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children: [textNode(text)],
})

const verseBlockNode = (text: string): LexNode => ({
  type: 'block',
  version: 2,
  format: '',
  fields: {
    id: crypto.randomBytes(12).toString('hex'),
    blockName: '',
    blockType: 'verse',
    text,
  },
})

/** Payload के premade CodeBlock का slug 'Code' है (बड़ा C). */
const codeBlockNode = (language: string, code: string): LexNode => ({
  type: 'block',
  version: 2,
  format: '',
  fields: {
    id: crypto.randomBytes(12).toString('hex'),
    blockName: '',
    blockType: 'Code',
    language,
    code,
  },
})

/** CodeBlock सिर्फ़ जानी-पहचानी भाषाएँ लेता है / only known keys validate. */
const CODE_LANGUAGES = new Set(['html', 'markdown', 'css', 'javascript', 'typescript', 'json', 'yaml', 'shell', 'plaintext'])

// ── body tokenisation ───────────────────────────────────────────────────────

type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'verse'; text: string }
  | { kind: 'lyric'; lines: string[] }
  | { kind: 'center'; text: string }
  | { kind: 'code'; language: string; code: string }

/**
 * कोड वाले हिस्से, जिन्हें छूना नहीं है / code ranges that must never be rewritten.
 *
 * दोनों ज़रूरी हैं: ``` वाला ब्लॉक और ` ` वाला inline कोड।
 * Both forms matter here. "नई रचना कैसे जोड़ें" is a guide that *teaches* this
 * HTML, so it contains `<p class="lyric">` inside a ``` fence AND
 * `<p class="center">…</p>` inline in backticks. Converting either would destroy
 * the very example the post is explaining — fences are found first so an inline
 * match inside a fence cannot double-count.
 */
type Fence = { start: number; end: number; language: string; code: string }

/**
 * ``` वाले हिस्से / fenced code blocks, pulled out as their own segments.
 *
 * ये markdown converter के हवाले नहीं किए जा सकते: वह ``` को पहचानता ही नहीं,
 * fence की लकीरें सादा text बन जाती हैं और अंदर का `---` लकीर (hr) बन जाता है।
 * These cannot be left to the markdown converter — it does not recognise fences
 * at all, so the ``` markers survive as literal text and a `---` inside the
 * example is misparsed into a horizontal rule. Verified against post 2, which is
 * a guide made almost entirely of code examples.
 */
function fenceBlocks(body: string): Fence[] {
  const fences: Fence[] = []
  const re = /```([A-Za-z0-9_-]*)\r?\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const lang = m[1].toLowerCase()
    fences.push({
      start: m.index,
      end: m.index + m[0].length,
      language: CODE_LANGUAGES.has(lang) ? lang : 'plaintext',
      code: m[2].replace(/\r?\n$/, ''),
    })
  }
  return fences
}

/**
 * ` ` वाला inline कोड — इसे markdown में ही रहने देना है, बस HTML न समझा जाए.
 * Inline code stays part of its markdown segment; it only needs shielding from
 * the raw-HTML rewrites. Post 2 contains `<p class="center">…</p>` inline, and
 * converting it would destroy the example the sentence is explaining.
 */
function inlineCodeRanges(body: string, fences: Fence[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const re = /`[^`\n]+`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const start = m.index
    if (!fences.some((f) => start >= f.start && start < f.end)) {
      ranges.push([start, start + m[0].length])
    }
  }
  return ranges
}

const inFence = (i: number, ranges: Array<[number, number]>) =>
  ranges.some(([s, e]) => i >= s && i < e)

/**
 * नेस्टेड <div> का सही अंत खोजिए / find the matching close of a nested <div>.
 * A non-greedy regex would stop at the first `</div>`, which is the inner
 * `.stanza` — losing the rest of the poem.
 */
function matchDivEnd(body: string, start: number): number {
  const re = /<div\b[^>]*>|<\/div>/g
  re.lastIndex = start
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return m.index + m[0].length
  }
  throw new Error('unbalanced <div> in post body')
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()

/** <div class="verse"> -> बंद, खाली पंक्ति से अलग / stanzas split by blank lines. */
function verseToText(html: string): string {
  const stanzas: string[] = []
  const re = /<div class="stanza">([\s\S]*?)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const lines = m[1]
      .split(/<br\s*\/?>/i)
      .map((l) => stripTags(l))
      .filter(Boolean)
    if (lines.length) stanzas.push(lines.join('\n'))
  }
  if (!stanzas.length) throw new Error('verse block contained no stanzas')
  return stanzas.join('\n\n')
}

function segmentBody(body: string): Segment[] {
  const fences = fenceBlocks(body)
  const inlineCode = inlineCodeRanges(body, fences)
  const segments: Segment[] = []
  let cursor = 0
  let i = 0

  const pushMarkdown = (upto: number) => {
    const text = body.slice(cursor, upto)
    if (text.trim()) segments.push({ kind: 'markdown', text })
  }

  while (i < body.length) {
    // ``` वाला ब्लॉक अपना अलग segment बनता है / a fence becomes its own block.
    const fence = fences.find((f) => f.start === i)
    if (fence) {
      pushMarkdown(i)
      segments.push({ kind: 'code', language: fence.language, code: fence.code })
      cursor = i = fence.end
      continue
    }

    // inline कोड markdown में ही रहता है, बस HTML न समझा जाए।
    if (inlineCode.some(([s, e]) => i >= s && i < e)) {
      i++
      continue
    }

    if (body.startsWith('<div class="verse">', i)) {
      const end = matchDivEnd(body, i)
      pushMarkdown(i)
      segments.push({ kind: 'verse', text: verseToText(body.slice(i, end)) })
      cursor = i = end
      continue
    }

    if (body.startsWith('<p class="lyric">', i)) {
      const close = body.indexOf('</p>', i)
      if (close === -1) throw new Error('unclosed <p class="lyric">')
      const end = close + 4
      pushMarkdown(i)
      const lines = body
        .slice(i + '<p class="lyric">'.length, close)
        .split(/<br\s*\/?>/i)
        .map((l) => stripTags(l))
        .filter(Boolean)
      segments.push({ kind: 'lyric', lines })
      cursor = i = end
      continue
    }

    if (body.startsWith('<p class="center">', i)) {
      const close = body.indexOf('</p>', i)
      if (close === -1) throw new Error('unclosed <p class="center">')
      const end = close + 4
      pushMarkdown(i)
      segments.push({
        kind: 'center',
        text: stripTags(body.slice(i + '<p class="center">'.length, close)),
      })
      cursor = i = end
      continue
    }

    i++
  }

  pushMarkdown(body.length)
  return segments
}

// ── main ────────────────────────────────────────────────────────────────────

const payload = await getPayload({ config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })

const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.md')).sort()
console.log(`\nFound ${files.length} markdown file(s) in ${POSTS_DIR}\n`)

const categoryIds = new Map<string, number>()

async function upsertCategory(name: string): Promise<number> {
  const cached = categoryIds.get(name)
  if (cached) return cached

  const existing = await payload.find({
    collection: 'categories',
    where: { name: { equals: name } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const id = existing.docs[0].id as number
    categoryIds.set(name, id)
    return id
  }

  // श्रेणी का slug रोमन में — देवनागरी से बन नहीं सकता.
  const slugMap: Record<string, string> = {
    'संस्मरण': 'sansmaran',
    'कविता': 'kavita',
    'मार्गदर्शन': 'margdarshan',
  }
  const slug = slugMap[name]
  if (!slug) {
    throw new Error(
      `No roman slug known for category "${name}". Add it to slugMap in this script — ` +
        `it cannot be generated from Devanagari.`,
    )
  }

  const created = await payload.create({
    collection: 'categories',
    data: { name, slug },
    overrideAccess: true,
  })
  console.log(`  + category "${name}" -> /${slug}`)
  categoryIds.set(name, created.id as number)
  return created.id as number
}

let created = 0
let updated = 0

for (const file of files) {
  const slug = file.replace(/\.md$/, '')
  const raw = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
  const { data, body } = parseFrontmatter(raw, file)

  const segments = segmentBody(body)
  const children: LexNode[] = []
  const tally: Record<string, number> = {}

  for (const seg of segments) {
    tally[seg.kind] = (tally[seg.kind] ?? 0) + 1
    if (seg.kind === 'markdown') {
      const converted = convertMarkdownToLexical({ editorConfig, markdown: seg.text })
      children.push(...((converted.root.children ?? []) as LexNode[]))
    } else if (seg.kind === 'verse') {
      children.push(verseBlockNode(seg.text))
    } else if (seg.kind === 'lyric') {
      children.push(quoteNode(seg.lines))
    } else if (seg.kind === 'center') {
      children.push(centeredParagraph(seg.text))
    } else if (seg.kind === 'code') {
      children.push(codeBlockNode(seg.language, seg.code))
    } else {
      // हर तरह का segment ऊपर सँभल जाना चाहिए / every kind is handled above.
      // A bare `else` here previously swallowed the `code` case as if it were
      // `center`, which tsx never caught because it does not type-check.
      const unreachable: never = seg
      throw new Error(`unhandled segment: ${JSON.stringify(unreachable)}`)
    }
  }

  const content = {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children,
    },
  }

  const parsedDate = parseHindiDate(data.date)

  const doc = {
    title: data.title,
    slug,
    excerpt: data.excerpt,
    content,
    category: await upsertCategory(data.category),
    displayDate: data.date,
    publishedAt: (parsedDate ?? new Date()).toISOString(),
    order: data.order,
    _status: data.draft ? ('draft' as const) : ('published' as const),
  }

  const existing = await payload.find({
    collection: 'posts',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
    draft: true,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'posts',
      id: existing.docs[0].id,
      data: doc as never,
      overrideAccess: true,
    })
    updated++
    console.log(`  ~ updated  ${slug}`)
  } else {
    await payload.create({ collection: 'posts', data: doc as never, overrideAccess: true })
    created++
    console.log(`  + created  ${slug}`)
  }

  const parts = Object.entries(tally)
    .map(([k, v]) => `${k}×${v}`)
    .join('  ')
  console.log(
    `      "${data.title}"  date="${data.date}"  order=${data.order}  status=${doc._status}` +
      (parsedDate ? '' : '  (date not parseable — fell back to today)'),
  )
  console.log(`      segments: ${parts}   -> ${children.length} top-level nodes`)
}

console.log(`\nDone. ${created} created, ${updated} updated.\n`)
process.exit(0)
