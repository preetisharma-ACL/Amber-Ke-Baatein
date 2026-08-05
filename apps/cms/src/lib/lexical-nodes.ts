/**
 * Lexical के node बनाने वाले / builders for Payload's Lexical documents.
 *
 * ── यहाँ अलग क्यों / why these live in their own module ──────────────────────
 * दो जगह इनकी ज़रूरत है: markdown वाली migration और Claude से भरने वाला हिस्सा।
 * Two callers need them: the one-shot markdown importer
 * (scripts/migrate-markdown.ts) and the Claude autofill endpoint. Both must
 * produce byte-identical structures, because both feed the same editor and the
 * same site renderer — a second, drifting implementation would show up as
 * poems that render correctly when imported and subtly wrong when generated.
 *
 * इन्हें बदलने से पहले packages/shared/src/lexical.ts देख लीजिए — वही इन्हें
 * वापस HTML में बदलता है।
 * Anything changed here must stay in step with packages/shared/src/lexical.ts,
 * which renders these nodes back to HTML for the site.
 */
import crypto from 'node:crypto'

export type LexNode = Record<string, unknown>

export const textNode = (text: string): LexNode => ({
  type: 'text',
  text,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})

export const lineBreak = (): LexNode => ({ type: 'linebreak', version: 1 })

/** पंक्तियों के बीच <br> / interleaves real linebreak nodes between lines. */
export function linesToChildren(lines: string[]): LexNode[] {
  const children: LexNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) children.push(lineBreak())
    children.push(textNode(line))
  })
  return children
}

export const paragraphNode = (text: string): LexNode => ({
  type: 'paragraph',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children: [textNode(text)],
})

/** उद्धृत पंक्तियाँ — साइट पर `.lyric` बनकर दिखती हैं. */
export const quoteNode = (lines: string[]): LexNode => ({
  type: 'quote',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  children: linesToChildren(lines),
})

/** बीचोंबीच एक पंक्ति — साइट पर `.center`. */
export const centeredParagraph = (text: string): LexNode => ({
  type: 'paragraph',
  version: 1,
  format: 'center',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children: [textNode(text)],
})

/**
 * कविता का ब्लॉक / the verse block.
 * `text` में खाली पंक्ति = नया बंद, अकेली newline = <br>.
 * Blank line separates stanzas; a single newline is a line break.
 */
export const verseBlockNode = (text: string): LexNode => ({
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
export const codeBlockNode = (language: string, code: string): LexNode => ({
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
export const CODE_LANGUAGES = new Set([
  'html',
  'markdown',
  'css',
  'javascript',
  'typescript',
  'json',
  'yaml',
  'shell',
  'plaintext',
])

/** पूरा document लपेटिए / wrap top-level nodes into a Lexical root. */
export const lexicalRoot = (children: LexNode[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children,
  },
})
