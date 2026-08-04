/**
 * Lexical (Payload का richtext) -> HTML.
 *
 * ── यह अपना क्यों लिखा है / why this is hand-written ──────────────────────────
 * Payload ships its own converter, but pulling `@payloadcms/richtext-lexical`
 * into the Astro site would drag React and the whole admin bundle into a static
 * poetry blog. More importantly, this file maps Lexical nodes onto the site's
 * *existing* class names — `.verse`/`.stanza`, `.lyric`, `.center` — so the CSS
 * written for the old hand-authored HTML keeps working untouched. A generic
 * converter would emit <blockquote> and the styling would silently be lost.
 *
 * हर text escape होता है / everything is escaped: the guide post legitimately
 * contains `<div class="verse">` as literal example text, and it must render as
 * visible characters, not as markup.
 */

export interface LexicalNode {
  type?: string
  version?: number
  tag?: string
  text?: string
  format?: number | string
  listType?: string
  fields?: Record<string, unknown>
  children?: LexicalNode[]
  [key: string]: unknown
}

export interface LexicalRoot {
  root: LexicalNode
}

/** Lexical के text format bits / Lexical's inline format bitmask. */
const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16
const FORMAT_SUBSCRIPT = 32
const FORMAT_SUPERSCRIPT = 64

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** एक text node, उसके bold/italic आदि के साथ. */
function renderText(node: LexicalNode): string {
  let html = escapeHtml(node.text ?? '')
  const format = typeof node.format === 'number' ? node.format : 0

  // कोड सबसे अंदर / innermost so <code> hugs the text.
  if (format & FORMAT_CODE) html = `<code>${html}</code>`
  if (format & FORMAT_BOLD) html = `<strong>${html}</strong>`
  if (format & FORMAT_ITALIC) html = `<em>${html}</em>`
  if (format & FORMAT_UNDERLINE) html = `<u>${html}</u>`
  if (format & FORMAT_STRIKETHROUGH) html = `<s>${html}</s>`
  if (format & FORMAT_SUBSCRIPT) html = `<sub>${html}</sub>`
  if (format & FORMAT_SUPERSCRIPT) html = `<sup>${html}</sup>`
  return html
}

/**
 * कविता का ब्लॉक / the verse block.
 *
 * खाली पंक्ति = नया बंद, अकेली newline = <br>. यही पुराने markup जैसा है।
 * Blank line starts a new `.stanza`, a single newline becomes `<br>` — which
 * reproduces exactly the `<div class="verse"><div class="stanza">` markup the
 * posts used to contain by hand.
 */
function renderVerse(text: string): string {
  const stanzas = text
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((stanza) => {
      const lines = stanza
        .split(/\r?\n/)
        .map((l) => escapeHtml(l.trim()))
        .filter(Boolean)
      return `<div class="stanza">${lines.join('<br>')}</div>`
    })
  return `<div class="verse">${stanzas.join('')}</div>`
}

function renderBlock(node: LexicalNode): string {
  const fields = node.fields ?? {}
  const blockType = fields.blockType

  if (blockType === 'verse') {
    return renderVerse(String(fields.text ?? ''))
  }

  if (blockType === 'Code') {
    const language = String(fields.language ?? 'plaintext')
    return (
      `<pre class="code-block" data-language="${escapeHtml(language)}">` +
      `<code>${escapeHtml(String(fields.code ?? ''))}</code></pre>`
    )
  }

  // अनजाना block चुपचाप गिरा देना ठीक नहीं, पर पन्ना भी नहीं तोड़ना।
  // An unknown block should not break the page, but silently dropping it would
  // hide missing content — leave a comment so it is findable in view-source.
  return `<!-- unsupported block: ${escapeHtml(String(blockType ?? 'unknown'))} -->`
}

function renderChildren(nodes: LexicalNode[] | undefined): string {
  return (nodes ?? []).map(renderNode).join('')
}

function renderNode(node: LexicalNode): string {
  switch (node.type) {
    case 'text':
      return renderText(node)

    case 'linebreak':
      return '<br>'

    case 'tab':
      return '&nbsp;&nbsp;'

    case 'paragraph': {
      const inner = renderChildren(node.children)
      // खाली paragraph से बेकार जगह बनती है / drop empties, they add stray gaps.
      if (!inner.trim()) return ''
      const align = typeof node.format === 'string' ? node.format : ''
      const cls = align === 'center' ? ' class="center"' : align ? ` class="align-${align}"` : ''
      return `<p${cls}>${inner}</p>`
    }

    case 'heading': {
      const tag = typeof node.tag === 'string' ? node.tag : 'h2'
      return `<${tag}>${renderChildren(node.children)}</${tag}>`
    }

    /**
     * उद्धरण -> पुरानी `.lyric` शैली / quotes reuse the original lyric styling,
     * which is what these have always been: quoted song or verse lines.
     */
    case 'quote':
      return `<p class="lyric">${renderChildren(node.children)}</p>`

    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${tag}>${renderChildren(node.children)}</${tag}>`
    }

    case 'listitem':
      return `<li>${renderChildren(node.children)}</li>`

    case 'horizontalrule':
      return '<hr>'

    case 'link':
    case 'autolink': {
      const fields = node.fields ?? {}
      const url = String(fields.url ?? fields.doc ?? '#')
      const newTab = fields.newTab === true
      const rel = newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(url)}"${rel}>${renderChildren(node.children)}</a>`
    }

    case 'upload': {
      const value = (node.value ?? {}) as { url?: string; alt?: string }
      if (!value.url) return ''
      return `<img src="${escapeHtml(value.url)}" alt="${escapeHtml(value.alt ?? '')}" loading="lazy">`
    }

    case 'block':
      return renderBlock(node)

    case 'root':
      return renderChildren(node.children)

    default:
      // बच्चे तो दिखा ही दीजिए, वरना पूरा हिस्सा ग़ायब हो जाएगा।
      // Render children rather than dropping the subtree, so an unrecognised
      // wrapper degrades to its content instead of vanishing.
      return renderChildren(node.children)
  }
}

/** पूरी रचना का HTML / render a whole Lexical document to HTML. */
export function lexicalToHtml(doc: LexicalRoot | null | undefined): string {
  if (!doc?.root) return ''
  return renderChildren(doc.root.children)
}

/**
 * बिना markup का text — meta description वग़ैरह के लिए.
 * Plain text for meta descriptions and previews.
 */
export function lexicalToPlainText(doc: LexicalRoot | null | undefined): string {
  if (!doc?.root) return ''
  const walk = (nodes: LexicalNode[] | undefined): string =>
    (nodes ?? [])
      .map((n) => {
        if (n.type === 'text') return n.text ?? ''
        if (n.type === 'linebreak') return ' '
        if (n.type === 'block' && n.fields?.blockType === 'verse') {
          return String(n.fields.text ?? '')
        }
        return walk(n.children)
      })
      .join(' ')
  return walk(doc.root.children).replace(/\s+/g, ' ').trim()
}
