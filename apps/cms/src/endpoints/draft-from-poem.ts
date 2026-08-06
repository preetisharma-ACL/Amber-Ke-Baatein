import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Endpoint } from 'payload'
import * as z from 'zod/v4'

import { centeredParagraph, lexicalRoot, paragraphNode, quoteNode, verseBlockNode, type LexNode } from '../lib/lexical-nodes'

/**
 * कविता चिपकाइए, बाक़ी खाने अपने-आप भर जाएँ.
 * POST /api/draft-from-poem — paste a poem, get every field filled in.
 *
 * ── काम का बँटवारा / how the work is split ─────────────────────────────────
 * Claude सिर्फ़ वही करता है जो समझ का काम है; बाक़ी सब code गिनता है।
 * Claude does only the judgement: transliterating the title into a roman slug,
 * picking a category, writing the excerpt, and — the part no regex can do —
 * deciding which lines are verse, which are a quoted song, and which are prose.
 *
 * Everything deterministic stays in code: today's date in Hindi, the sort
 * order, slug uniqueness, and the Lexical node construction. Asking a model to
 * emit Lexical JSON directly would mean trusting it to get `format`, `indent`
 * and `version` right on every node, where one bad field breaks the editor —
 * so it returns classified segments and the tested builders do the rest.
 */

// ── Claude से क्या चाहिए / the shape Claude must return ──────────────────────

const SegmentSchema = z.object({
  /**
   * verse  = कविता (खाली पंक्ति से बंद अलग)   / poetry, blank line = new stanza
   * lyric  = किसी और का गीत/शेर, उद्धृत       / someone else's quoted lines
   * center = बीचोंबीच रखी अकेली पंक्ति        / a single centred line
   * paragraph = सादा गद्य                     / plain prose
   *
   * ⚠️ verse और lyric का फ़र्क़ यह नहीं कि पंक्तियाँ कैसी दिखती हैं — यह है कि वे
   * किसकी हैं। इस लेखक की अपनी कविताएँ भी गद्य के बीच अलग रखी होती हैं, इसलिए
   * "अलग रखी है" से lyric मत समझिए. The prompt spells this out; getting it wrong
   * is what makes a poem render as a quotation instead of a verse block.
   */
  kind: z.enum(['paragraph', 'verse', 'lyric', 'center']),
  /** newline अपनी जगह रखता है — verse और lyric में यही पंक्तियाँ बाँटता है. */
  text: z.string(),
})

const DraftSchema = z.object({
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  /** मौजूदा श्रेणियों में से एक, या खाली / one of the supplied names, or "". */
  categoryName: z.string(),
  segments: z.array(SegmentSchema),
})

// ── तारीख़ / the Hindi display date, computed here rather than guessed ───────

const HINDI_MONTHS = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
]

const hindiDate = (d: Date) => `${d.getDate()} ${HINDI_MONTHS[d.getMonth()]} ${d.getFullYear()}`

// ── श्रेणियों का मतलब / what each category actually means ────────────────────

/**
 * नाम काफ़ी नहीं — मतलब भी चाहिए / a name alone does not classify well.
 *
 * पहले prompt सिर्फ़ श्रेणियों के नाम भेजता था, और Claude नाम से अंदाज़ा लगाता था।
 * "छोटी-छोटी खुशियाँ" जैसी रचना — जो असल में संस्मरण है पर सीख भी देती है —
 * इसीलिए "मार्गदर्शन" में चली जाती थी।
 *
 * The prompt used to send bare category names and let the model infer what they
 * meant. That guesses badly exactly where it matters: a memoir that happens to
 * carry a lesson reads as "guidance" from the name alone, when the piece is
 * fundamentally a remembered afternoon with one's father.
 *
 * ── सूची यहाँ तय नहीं होती / this is not the list ────────────────────────────
 * श्रेणियाँ CMS से आती हैं, यहाँ से नहीं। यह सिर्फ़ मतलब बताता है। नई श्रेणी जुड़े
 * और यहाँ उसका ज़िक्र न हो, तब भी वह चुनी जा सकती है — prompt कहता है कि नाम का
 * अर्थ पढ़कर तय करो।
 *
 * The live list still comes from the database — this only annotates it. A
 * category added in the CMS and not described here still appears and can still
 * be chosen; the prompt tells the model to reason from the name's meaning. That
 * way adding a category never requires a code change, and this map degrades to
 * "no note" rather than to "cannot pick it".
 */
const CATEGORY_NOTES: Record<string, string> = {
  कविता:
    'poetry. Written in verse — rhyme or free verse — to move the reader rather ' +
    'than to explain. Imagery, metaphor, rhythm. Choose it when the piece IS a ' +
    'poem, not when a prose piece merely contains one.',
  सुविचार:
    'a short reflective or inspirational thought. Brief, self-contained, stands ' +
    'on its own without surrounding context — a life lesson, a principle, a ' +
    'piece of wisdom. Never use this for a long explanatory article.',
  संस्मरण:
    'memoir. A real experience, memory or incident, usually first person — ' +
    'childhood, family, travel, a particular day. Still संस्मरण when the memory ' +
    'carries a lesson, as long as the experience is the point.',
  मार्गदर्शन:
    'guidance. Primarily teaches, advises or explains: practical advice, steps, ' +
    'how something works, how to do something better. A long piece explaining ' +
    'habits or method is मार्गदर्शन, not सुविचार.',
}

/** श्रेणी की सूची, मतलब के साथ / the live list, annotated where we know the name. */
const describeCategories = (categories: string[]) =>
  categories.length
    ? categories
        .map((name) => {
          const note = CATEGORY_NOTES[name]
          return note ? `  - ${name} — ${note}` : `  - ${name}`
        })
        .join('\n')
    : '  (none exist yet)'

// ── prompt ──────────────────────────────────────────────────────────────────

// जाँच के लिए export किया गया — असली prompt पर ही परखा जा सके, नक़ल पर नहीं.
// Exported so a test can exercise the real prompt rather than a copy of it,
// which would pass while the shipped one stays wrong.
export const systemPrompt = (categories: string[]) => `
आप "अम्बर की बातें" के लिए काम कर रहे हैं — आलोक कुमार सिंह का हिन्दी ब्लॉग, जहाँ
कविताएँ और संस्मरण छपते हैं।

You are preparing a pasted Hindi poem or memoir for publication on अम्बर की बातें.
Return the fields the CMS needs.

**पता / slug** — the hardest field, and the reason this exists. Transliterate the
title into Latin letters the way a Hindi speaker would read it aloud: lowercase,
words joined by hyphens, no diacritics, digits allowed. It must match
^[a-z0-9]+(-[a-z0-9]+)*$. Existing posts read like:
  "कुछ पाया — कुछ छूट गया"  ->  kuch-paya-kuch-chhoot-gaya
  "नई रचना कैसे जोड़ें"      ->  naye-rachna-kaise-jodein
Keep it to roughly 3–6 words; drop dashes, punctuation and filler.

**शीर्षक / title** — use the author's own title if the text carries one. If it
does not, take a striking phrase from the poem itself rather than inventing a
summary; this author titles from his own lines.

**झलक / excerpt** — two or three lines in Hindi, drawn from the opening, that
tell a reader what they are about to read. Under 300 characters. Do not
editorialise or praise the work.

**श्रेणी / category** — choose exactly one name from this list, copied exactly:
${describeCategories(categories)}

Never pick a category by keyword. Read the whole piece first and work out what
the author was trying to do; classify what the writing fundamentally IS, not what
it happens to mention. Weigh, in this order:

  1. the author's intent      (highest)
  2. the writing style
  3. the overall theme
  4. the tone
  5. individual keywords      (lowest — a word appearing proves nothing)

Where more than one could fit, choose the one matching the MAIN purpose:
  - a personal story that teaches something is संस्मरण when the experience is
    the point — a lesson drawn at the end does not make it मार्गदर्शन;
  - a long article explaining how to build a habit is मार्गदर्शन, not सुविचार,
    however inspiring it is;
  - a few short standalone motivational lines are सुविचार;
  - writing whose emotion is carried in verse is कविता.

A category may be listed above without a description — one added since this
prompt was written. Judge it from the meaning of its name and the same rules;
being undescribed does not make it a worse choice.

If none genuinely fits, return "" and a human will choose. Do not invent a name,
and do not pick a near-miss to avoid returning "".

**segments** — split the body in order. This is the judgement that matters:
  - "verse"  — poetry. Put each poem in one segment; keep the line breaks, and
    separate stanzas with a blank line.
  - "lyric"  — lines quoted from SOMEONE ELSE (a film song, another poet's
    couplet).
  - "center" — a single short line the author means to stand alone. One line, not
    a stanza.
  - "paragraph" — prose. One segment per paragraph.

**verse बनाम lyric / verse vs lyric — the distinction is authorship, not looks.**
This author writes memoir with his own poetry set into it, so several lines of
verse sitting between two prose paragraphs are almost always HIS. Being short,
indented, or visually separated tells you nothing — his verses look exactly like
that.

Use "lyric" only with actual evidence the lines belong to someone else: a named
film, singer or poet; quotation marks around them; or a phrase introducing them
as a quotation ("जैसा किसी ने कहा है", "फ़िल्म का वो गाना", "किसी शायर ने लिखा है").

**अनिश्चित हो तो "verse" चुनिए / when in doubt choose "verse".** Misclassifying his
poem as a quotation strips the styling the poems are meant to carry, and that is
the more damaging of the two mistakes.

Reproduce the author's words exactly. Do not correct spelling, rewrite phrasing,
or add lines that are not there.
`.trim()

// ── endpoint ────────────────────────────────────────────────────────────────

export const draftFromPoem: Endpoint = {
  path: '/draft-from-poem',
  method: 'post',
  handler: async (req) => {
    // बिना लॉगिन नहीं / staff only: this spends money on every call.
    if (!req.user) {
      return Response.json({ error: 'लॉगिन ज़रूरी है / authentication required.' }, { status: 403 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        {
          error:
            'ANTHROPIC_API_KEY नहीं मिली — .env में जोड़िए / not set. Add it to the repo-root .env and restart the CMS.',
        },
        { status: 500 },
      )
    }

    const body = (await req.json?.()) as { poem?: unknown } | undefined
    const poem = typeof body?.poem === 'string' ? body.poem.trim() : ''
    if (poem.length < 20) {
      return Response.json(
        { error: 'कविता चिपकाइए / paste the poem first (at least a couple of lines).' },
        { status: 400 },
      )
    }

    // मौजूदा श्रेणियाँ / the real category list, so Claude can only pick a live one.
    const categories = await req.payload.find({
      collection: 'categories',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    const categoryNames = categories.docs.map((c) => String(c.name))

    // 529 (overloaded) असल में आता है — SDK खुद backoff के साथ दोबारा कोशिश करता है।
    // Transient 529s are common enough to hit in normal use. The SDK retries
    // 429/5xx with exponential backoff on its own; 4 is chosen over the default
    // 2 because a person is sitting and waiting, and a silent extra retry is
    // far better for them than an error they have to understand and act on.
    const client = new Anthropic({ maxRetries: 4 })

    let draft: z.infer<typeof DraftSchema> | null = null
    try {
      const message = await client.messages.parse({
        /**
         * Haiku 4.5 — आपके कहने पर / your call.
         *
         * सबसे सस्ता और तेज़ मॉडल। यह काम — शीर्षक का रोमन में लिप्यंतरण और यह
         * पहचानना कि कौन-सी पंक्तियाँ कविता हैं — भारी सोच का नहीं है।
         *
         * The cheapest and fastest of the current models, at roughly a third of
         * Sonnet 5's price. This job is transliteration plus classification, not
         * reasoning, so it is a reasonable fit — but Haiku is a much smaller
         * model, and the slug is the one output where a wrong answer is
         * permanent (it becomes the post's URL). Re-check the first few posts.
         *
         * बदलना हो तो सिर्फ़ यह पंक्ति / to change models, edit this one line —
         * nothing else in the codebase depends on the choice.
         */
        model: 'claude-haiku-4-5',
        max_tokens: 16000,
        output_config: {
          /**
           * ⚠️ यहाँ `effort` मत जोड़िए / do NOT add `effort` here.
           *
           * Haiku 4.5 इसे स्वीकार नहीं करता — हर अनुरोध 400 देगा।
           * Haiku 4.5 rejects the effort parameter outright: every request would
           * fail with a 400. It was set to `medium` while this ran on Sonnet 5
           * and had to be removed with the model switch. If you move back to a
           * Sonnet or Opus model, effort can (and should) come back.
           */
          format: zodOutputFormat(DraftSchema),
        },
        system: systemPrompt(categoryNames),
        messages: [{ role: 'user', content: poem }],
      })

      // सुरक्षा जाँच से पहले मना करने की स्थिति देखिए / check refusal before reading output.
      if (message.stop_reason === 'refusal') {
        return Response.json(
          { error: 'Claude ने यह पाठ संभालने से मना किया / the request was declined.' },
          { status: 422 },
        )
      }
      draft = message.parsed_output
    } catch (err) {
      req.payload.logger.error({ err }, 'draft-from-poem: Claude call failed')

      /**
       * निदेशक जी को कच्चा error नहीं दिखना चाहिए.
       * The person reading this is a writer, not an engineer — a raw
       * `529 {"type":"error",…}` blob tells them nothing they can act on. Map
       * each failure to what they should actually *do*, and keep the technical
       * detail in the server log above.
       */
      const status = (err as { status?: number }).status
      const message =
        status === 429 || status === 529
          ? 'Claude अभी व्यस्त है — एक-दो मिनट बाद फिर "भरिए" दबाइए। / Claude is busy right now; wait a minute and press Fill again.'
          : status === 401
            ? 'API key ग़लत या रद्द है — .env में ANTHROPIC_API_KEY जाँचिए। / Invalid API key.'
            : status === 400
              ? 'यह पाठ Claude स्वीकार नहीं कर पाया — शायद बहुत लंबा है। / Claude rejected the input; it may be too long.'
              : `Claude से बात नहीं हो पाई / could not reach Claude${status ? ` (HTTP ${status})` : ''}.`

      // 429/529 पर 503 लौटाइए — "फिर कोशिश कीजिए" का सही संकेत यही है।
      return Response.json({ error: message, retryable: status === 429 || status === 529 }, {
        status: status === 429 || status === 529 ? 503 : 502,
      })
    }

    if (!draft) {
      return Response.json({ error: 'Claude ने खाली जवाब दिया / empty response.' }, { status: 502 })
    }

    // ── अब code का हिस्सा / everything below is deterministic ────────────────

    // slug साफ़ कीजिए और दोहराव से बचाइए / sanitise, then make it unique.
    let slug = draft.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!slug) slug = 'rachna'

    const base = slug
    for (let n = 2; n < 50; n++) {
      const clash = await req.payload.find({
        collection: 'posts',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        draft: true,
      })
      if (clash.totalDocs === 0) break
      slug = `${base}-${n}`
    }

    // नई रचना सबसे ऊपर / new posts sort above existing ones.
    const top = await req.payload.find({
      collection: 'posts',
      limit: 1,
      sort: '-order',
      depth: 0,
      overrideAccess: true,
      draft: true,
    })
    const order = ((top.docs[0]?.order as number | undefined) ?? 0) + 10

    const matched = categories.docs.find((c) => String(c.name) === draft!.categoryName)

    const children: LexNode[] = draft.segments.map((seg) => {
      switch (seg.kind) {
        case 'verse':
          return verseBlockNode(seg.text.trim())
        case 'lyric':
          return quoteNode(
            seg.text
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean),
          )
        case 'center':
          return centeredParagraph(seg.text.trim())
        default:
          return paragraphNode(seg.text.trim())
      }
    })

    return Response.json({
      title: draft.title,
      slug,
      excerpt: draft.excerpt,
      categoryId: matched?.id ?? null,
      categoryName: matched ? String(matched.name) : null,
      displayDate: hindiDate(new Date()),
      publishedAt: new Date().toISOString(),
      order,
      content: lexicalRoot(children),
      // UI इससे बताता है कि क्या-क्या पहचाना गया / drives the "found N verses" note.
      summary: draft.segments.reduce<Record<string, number>>((acc, s) => {
        acc[s.kind] = (acc[s.kind] ?? 0) + 1
        return acc
      }, {}),
    })
  },
}
