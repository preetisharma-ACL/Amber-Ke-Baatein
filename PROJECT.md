# अम्बर की बातें — यह प्रोजेक्ट क्या है

*A guide to this project, for whoever needs to understand it — including you, six months from now.*

---

## 1. साधारण भाषा में / In plain language

**अम्बर की बातें** आलोक कुमार सिंह का हिन्दी ब्लॉग है — कविताएँ और संस्मरण।

This is a Hindi literary blog. Not a magazine, not a business site: one person's
poems and remembrances, published so that a reader might find their own feeling
in someone else's words. The site says it better than a spec could:

> कुछ बातें कहने के लिए होती हैं, कुछ सिर्फ़ रख देने के लिए।
> यह जगह दूसरी तरह की बातों के लिए है।

That purpose explains most of the decisions in here. The writing is the product.
Everything technical exists to get a poem onto a screen and out of the way.

### इसमें कौन-कौन / Who is involved

| भूमिका / Role | कौन / Who | क्या करते हैं / What they do |
|---|---|---|
| लेखक / Author | आलोक कुमार सिंह | Writes the poems and memoirs |
| प्रकाशक / Publisher | निदेशक जी (the director) | Publishes posts through the admin panel, approves comments |
| डेवलपर / Developer | you | Runs and maintains the two apps |
| पाठक / Readers | anyone | Read, like, share, comment |

**निदेशक जी technical नहीं हैं** — and that single fact shaped the whole design.
There is no markdown to learn, no files to edit, no git. They log into a page,
paste a poem, and press Publish.

---

## 2. पाठक क्या देखता है / What a reader gets

A dark, quiet, typographic site — warm cream text on near-black, terracotta
accents, no clutter.

| पन्ना / Page | |
|---|---|
| **होम** | The three newest रचनाएँ |
| **रचनाएँ** | Everything published |
| **श्रेणी** | Filter by category — संस्मरण, मार्गदर्शन, कविता |
| **यह क्यों** | Why the site exists |
| **गैलरी** | Photographs |
| **संपर्क** | Email, Instagram, YouTube |

Under every post: **पसंद / Like**, **साझा / Share** (WhatsApp first — for this
audience that is where a poem actually travels), and **बातचीत / Comments**.

Pages are static HTML from a CDN, so they open instantly. Likes and comments
load afterwards in the background — if the CMS is ever down, **the poem still
reads perfectly.** That was deliberate.

---

## 3. रचना छापने का तरीक़ा / How a post gets published

```
कविता लिखिए  →  admin में चिपकाइए  →  "भरिए" दबाइए  →  पढ़कर ठीक कीजिए  →  Publish
   write           paste into admin      Claude fills        review            publish
                                          every field
```

1. निदेशक जी open the admin panel and click **Create New**
2. They paste the whole poem into the **कविता से भरिए** box and press **भरिए**
3. Claude reads it and fills in everything — title, URL slug, excerpt, category,
   date, and the body with its verses correctly marked
4. They read it over, fix anything, and press **Publish**
5. The site rebuilds itself; the post is live

**Step 3 is the point of this project.** Without it, publishing means
understanding what a slug is, romanising a Devanagari title by hand, and
formatting verse. With it, publishing means pasting a poem.

---

## 4. तकनीकी ढाँचा / The technical shape

Three parts in one repository (an npm-workspaces monorepo):

```
                    ┌──────────────────────┐
   निदेशक जी ──────▶│  apps/cms            │──────┐
   (the author)     │  Payload 3 + Next 16 │      │
                    │  the admin panel     │      │  writes
                    └──────────┬───────────┘      ▼
                               │ reads      ┌─────────────┐
                               │            │    Neon     │
                    ┌──────────▼───────────┐│  Postgres   │
   पाठक      ◀─────│  apps/web            ││  (us-east-2)│
   (readers)        │  Astro 7, static     │└─────────────┘
                    └──────────────────────┘
                               ▲
                    ┌──────────┴───────────┐
                    │  packages/shared     │
                    │  types both apps use │
                    └──────────────────────┘
```

| | क्या है / What | क्यों / Why this |
|---|---|---|
| `apps/web` | Astro 7, **fully static** | A blog is read far more than it is written to. Static means instant pages, no server to maintain, near-zero hosting cost. |
| `apps/cms` | Payload 3 on Next.js 16 | Gives a non-technical author a real editor — drafts, version history, image uploads, comment moderation — without anyone building one. |
| `packages/shared` | plain TypeScript | Types and the Lexical→HTML renderer both apps need. No build step. |
| Neon | Postgres | Content is relational: posts ↔ categories ↔ comments. Postgres is the right shape, and Neon is managed and free at this size. |

### रफ़्तार का एक असली फ़ैसला / One real performance decision

The site is **static**, so a reader never touches the database. This matters
more than it sounds: the database is in Ohio and the people using it are in
India — about **265 milliseconds per query**, measured. If pages were rendered
per request, every reader would pay that. Instead it is paid once, at build
time. Likes and comments are fetched by the browser afterwards, so they cost the
page nothing.

---

## 5. हिन्दी ने जो तय किया / What the language decided

The most interesting engineering here comes from one fact: **Hindi does not
behave like English**, and most web tooling assumes English.

| समस्या / Problem | हल / Solution |
|---|---|
| **Slugs.** "कुछ पाया — कुछ छूट गया" cannot be slugified. Standard tools return an empty string or percent-encoded bytes. | Slugs are hand-picked romanisations (`kuch-paya-kuch-chhoot-gaya`). **Claude now generates them** — this is the single biggest thing the AI does. |
| **Dates.** "1 अगस्त 2026" is not parseable by any date library. | Two fields. `displayDate` is a plain string shown exactly as typed; `publishedAt` is a real timestamp used only for sorting. **Never parse the display date.** |
| **Poems.** Verse needs stanzas and line breaks; rich-text editors flatten both. | A custom **कविता block** in the editor. The author types plain lines, blank line = new stanza. |
| **Sorting.** Hindi strings do not sort meaningfully by default. | An explicit numeric `order` field, with `localeCompare(…, 'hi')` as a tiebreak. |
| **Typography.** Devanagari matras sit above and below the baseline and collide at Latin line-heights. | Taller line-height and a font stack that falls through per-glyph to a Devanagari face. |

The admin panel is **bilingual throughout** — "शीर्षक / Title", "पता / Slug" —
so the author reads Hindi and anyone reading the code or the API reads English.

---

## 6. Claude कहाँ है / Where the AI sits

One feature, one job: **turning a pasted poem into filled-in fields.**

```
कविता  →  Claude  →  { title, slug, excerpt, category, segments[] }  →  code  →  Lexical
```

The split is deliberate:

- **Claude decides what needs judgement** — the roman slug, which category fits,
  the excerpt, and which lines are verse vs quoted lyric vs prose.
- **Code computes everything deterministic** — the Hindi date, sort order, slug
  uniqueness, and the actual editor document.

Claude never returns editor JSON. It returns *classified segments*, and tested
code builds the document. Asking a model for a deep nested structure means
trusting it to get every field right on every node, where one mistake breaks the
editor.

| | |
|---|---|
| **Model** | `claude-haiku-4-5` |
| **Cost** | roughly **₹0.40 per poem** (~600 tokens in, ~900 out) |
| **Speed** | ~17 seconds per poem |
| **Where** | one line — `model:` in `apps/cms/src/endpoints/draft-from-poem.ts` |

**Why Haiku 4.5.** The work went Opus 5 → Sonnet 5 → Haiku 4.5. Opus was
dropped when it returned `529 overloaded` (capacity at Anthropic, never the API
key); Haiku was then chosen deliberately. All three were tested on the same real
post, and **Haiku matched Sonnet exactly** — same slug, same category, same
verse classification — while being faster and roughly a third of the price. That
holds because the task is transliteration and classification, not reasoning.

**Verified:** given the existing post as plain text, it reproduced the
hand-picked slug `kuch-paya-kuch-chhoot-gaya` **exactly**, chose the right
category, and identified both verse blocks with the correct stanza breaks.

⚠️ Two things to know if you change the model: `effort` must **not** be set on
Haiku 4.5 (it 400s), and Haiku writes the excerpt as a summary rather than
drawing from the opening as the prompt asks — the first place quality would
drift.

---

## 7. सामग्री का ढाँचा / The data model

| Collection | |
|---|---|
| **रचनाएँ / Posts** | title, slug, excerpt, body, category, cover image, displayDate, publishedAt, order, views, likes. Drafts + 20 versions of history. |
| **श्रेणियाँ / Categories** | name, slug, description |
| **तस्वीरें / Media** | uploads with alt text; thumbnail/card/hero sizes generated |
| **टिप्पणियाँ / Comments** | post, name, body, status (pending / approved / spam) |
| **सदस्य / Users** | staff logins — `admin` or `editor` |

### सुरक्षा के तीन नियम / Three rules worth knowing

1. **Drafts are private.** The public API filters to published only — it returns
   a query filter rather than an error, so drafts simply do not exist to the
   outside.
2. **Comments are approved before they appear.** A new comment lands as
   `pending`. Both field-level access *and* a hook pin this, so a crafted request
   cannot self-approve.
3. **Only admins create accounts.** An editor cannot promote themselves.

---

## 8. अभी क्या चल रहा है / Current state

**Working and verified:** the site, the CMS, publishing, drafts and versions,
categories, image uploads, the Claude autofill, likes with rate limiting, share,
comments with moderation, and automatic rebuild-on-publish.

**Not done yet:**

| | |
|---|---|
| **Deployment** | Runs only on your machine. This gates everything below. |
| **Image storage** | Uploads go to local disk. Will not survive a deploy — needs R2/S3. |
| **Email** | No adapter, so password reset silently fails. |
| **View counts** | Field exists, nothing increments it. |
| **DB migrations** | Schema is pushed in dev mode; production wants real migrations. |
| **Two placeholders** | The **यह क्यों** page still says *"यह ड्राफ़्ट है"*, and the bio in `site.ts` is instruction text. Both are visible to readers. |

Recommended deployment: **Cloudflare Pages** (site, free) + a Node host in
**US-East** near the database (CMS, ~$5/mo) + **R2** (images, free). The CMS must
be deployed first — the site's build fetches from it.

---

## 9. फ़ाइलें कहाँ हैं / Where things live

```
apps/web/                       the public site
  src/pages/                    routes — one file per page
  src/components/               PostCard, Comments, PostActions…
  src/utils/posts.ts            fetches posts from the CMS
  src/styles/global.css         the whole visual identity

apps/cms/                       the admin panel
  src/collections/              Posts, Categories, Media, Comments, Users
  src/endpoints/                draft-from-poem (Claude), like-post
  src/components/PoemAutofill   the "कविता से भरिए" panel
  src/hooks/revalidate-site     rebuilds the site when you publish
  src/lib/lexical-nodes.ts      builds editor documents
  src/app/(payload)/custom.scss the admin theme

packages/shared/src/lexical.ts  renders editor documents back to HTML
CLAUDE.md                       gotchas and traps — read before changing things
```

**`CLAUDE.md` is the operational companion to this file.** This one explains
what the project *is*; that one records the things that will bite you.

---

## 10. एक बात / One closing note

The unusual thing about this project is not the stack — Astro and Payload and
Postgres are ordinary choices. It is that almost every non-obvious decision
traces back to two constraints: **the language is Hindi**, and **the person
publishing is not an engineer.**

Slugs are typed rather than generated, dates are strings rather than timestamps,
poems are a custom block rather than rich text, and an AI fills the form — not
because any of that is clever, but because the alternative was asking a poet to
learn what a URL slug is.

If you change something here and it feels needlessly awkward, check those two
constraints first. It is usually one of them.
