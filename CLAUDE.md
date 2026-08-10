# अम्बर की बातें

npm-workspaces monorepo. Two deployable apps plus one shared package.

```
apps/web          Astro 7 — the public site (static)
apps/cms          Payload 3 on Next.js 16 — admin panel + REST/GraphQL API
packages/shared   Types and constants both apps import (raw .ts, no build step)
```

Content lives in **Neon Postgres**. Payload owns the schema; the Astro site reads
through the CMS API at build time.

**The markdown files in `apps/web/src/content/posts/` are dead.** They were the
source before the migration and are kept only as a backup and as input for
`migrate:markdown`. Editing them changes nothing — posts are edited at `/admin`.

Because the site is static and fetches at build time, **the CMS must be running
to build the site**. `npm run build` starts the CMS build first, but for
`build:web` alone you need `npm run dev:cms` up, or the build fails with a clear
"could not reach the CMS" error rather than silently publishing an empty site.

## Development

Run everything from the repo root — never `npm install` inside an app, it will
fight the workspace hoisting.

```
npm run dev        # both apps together
npm run dev:web    # Astro only     → http://localhost:4321
npm run dev:cms    # Payload only   → http://localhost:3456/admin
npm run build      # cms, then web
npm run check      # astro check (typecheck)
npm run generate:types   # regenerate apps/cms/src/payload-types.ts
```

**Ports.** The CMS runs on **3456**, not the usual 3000. Ports 3000/3001/3002/3111
are occupied by other projects on this machine (ACL_Portal, EstatePortalFront);
pointing Payload at one of those makes it fail to bind while requests get answered
by the *other* project — a confusing failure to debug. To move it, change both
`apps/cms/package.json` and the root `.env`.

## Environment

One `.env` at the repo root, read by both apps — `apps/web` via Vite's `envDir`,
`apps/cms` via `dotenv` in `payload.config.ts` and `next.config.ts`. Do not add
per-app `.env` files; the secret would drift between them. `.env.example` is the
committed template.

## Performance: the database is on another continent

**Every SQL round trip costs ~280ms.** Neon is in AWS `us-east-2` (Ohio); this
machine is in India. Measured with `npm run measure:db --workspace @amber/cms`:

| | measured |
|---|---|
| `SELECT 1` (warm, open connection) | **~280ms** |
| `SELECT count(*)` on a 1-row table | ~290ms |
| TCP connect (one handshake) | ~1.6s |
| `pg` connect (TCP + TLS + auth) | ~3–4s |

That ~280ms is a hard floor. A `payload.find()` issues 2–3 sequential
statements (count, rows, then one per populated relationship), so the API
cannot go below roughly `280ms × queries`. **99.7% of a `find()` is spent
waiting on the network** — not planning, scanning, or serialising.

Consequences that are easy to misdiagnose:

- **Indexes will not help.** They reduce scan time, and there is no scan time to
  reduce. `index: true` on `order`/`publishedAt` is there for future scale only.
- **Lowering `depth` genuinely helps**, because each level is another round
  trip. `defaultDepth` is 0 for this reason; ask for depth explicitly.
- **Never let a connection drop.** Rebuilding one costs ~4s, which is why the
  pool sets `keepAlive` and a 60s idle timeout.

The only real fix is moving the data closer — a Neon project in a region near
your users (check the region list in the Neon console), or a local Postgres for
development. At ~30ms RTT the same endpoint would land near 60–130ms instead of
550–640ms.

**Changing the Neon project does not help unless the region changes.** The
database was swapped once already (to `ep-mute-sunset-…-pooler`, still
`us-east-2`) and measured identically: ~265ms per round trip, ~554–710ms on
`/api/posts?limit=10`. Re-check any new database with `npm run measure:db
--workspace @amber/cms` before assuming a move improved anything.

Switching databases is not just an env change — a fresh Neon project is empty.
Payload pushes the schema on first connect in dev, but rows (posts, categories,
version history, **and the admin user account**) have to be copied over or the
CMS comes up with no content and no way to log in.

## Dev is not a performance measurement

`next dev` uses Turbopack and compiles routes on demand. Measured on `/admin`:
**~4s TTFB in dev vs ~14ms in a production build.** The admin's "36 chunks /
11.8MB" is likewise a dev artifact — a production build emits 3.9MB on disk,
before compression. Always re-measure with `npm run build:cms && npm run start
--workspace @amber/cms` before concluding anything is slow.

## Publishing a post → getting it on the site

The site is static. `getStaticPaths` in `posts/[slug].astro` decides which post
pages exist, and **Astro caches that result for the life of the dev server**,
re-running it only when the file changes. Left alone this produces a confusing
split: a published post appears on the homepage and `/posts` at once (those
refetch per request) while its own page 404s.

`src/hooks/revalidate-site.ts` (afterChange + afterDelete on Posts) closes that:

| | What the hook does |
|---|---|
| **dev** | Touches `posts/[slug].astro`. Both apps are on one machine, so the page is live ~3s after Publish. Nothing to run by hand. |
| **production** | POSTs to `SITE_DEPLOY_HOOK_URL` to trigger a rebuild. **Without that variable it only logs a warning** — the post will not reach the built site. |

Set `SITE_DEPLOY_HOOK_URL` when you deploy, or the author publishes into silence.
`npm run refresh:web` remains as a manual fallback.

The hook never blocks a save: every failure is caught and logged. Losing a
rebuild is a nuisance; losing someone's writing is not.

**`export const prerender = false` does not fix this.** The site is
`output: 'static'` with no adapter, so Astro has nowhere to render on demand and
the export is ignored. Serving post pages live would mean adding an adapter and
a Node server, and with the database ~300ms away that puts roughly 600ms on
every reader's page load to save the author one rebuild — the wrong trade for a
blog that is read far more often than it is written to.

## Uploads: Cloudinary

Everything uploaded — gallery photos, post cover images, recitations — goes to
Cloudinary, never to disk. `plugin-cloud-storage` sets `disableLocalStorage` on
`gallery`, `media` and `audio`, and `lib/cloudinary-adapter.ts` supplies the
four methods (upload, delete, generateURL, staticHandler). There is **no
official Cloudinary adapter**; Payload ships S3/Azure/GCS/Vercel Blob/
UploadThing only, which is why this one is hand-written.

- **The collections deliberately set no `imageSizes`.** Cloudinary resizes from
  the URL, so one stored original serves every size.
  `apps/web/src/utils/gallery.ts` → `cloudinaryVariant(url, 'w_840,c_limit,f_auto,q_auto')`
  splices the transform in after `/upload/`. Generating fixed derivatives at
  upload time would mean uploading near-duplicates and *still* being unable to
  serve a size nobody planned for.
- **Gallery is its own collection, separate from Media**, so post cover images
  do not turn up in the public grid.

⚠️ **`disablePayloadAccessControl: true` is what makes any of this work.** The
plugin calls `generateURL` *only* when that flag is set. Without it the stored
`url` is Payload's own `/api/gallery/file/<name>` route, which 302-redirects to
Cloudinary — so images load and everything looks fine. That is exactly what
makes it dangerous:

- every image travels through the CMS, so **the static site silently gains a
  runtime dependency on it**;
- the stored URL is absolute (`http://localhost:3456/…`), so **every image
  breaks the moment the site is deployed anywhere else**.

It is set on all three collections. Don't remove it to "tighten access" — these
hold public photographs, recitations and cover images, so there is no access
control being given up.

**`url` in Postgres can be stale, but it is not what gets served.** Measured on
this database (2026-08-07, `plugin-cloud-storage` 3.87.0): rows `gallery` 1 and 2
still store a `…/alok-kumar?_a=BAMAPqiu0` URL, while the API serves
`…/alok-kumar` — the plugin regenerates `url` on read from the collection prefix
plus `filename`, so the stored column is effectively a cache.

This section previously warned that a row saved while something was
misconfigured "stays wrong forever". That is **not** what this version does:
because the URL is rebuilt on read, a stale or localhost value in the column
does not reach the site. What still matters is **`filename`**, since that is
what the regenerated URL is built from — a file that never actually reached
Cloudinary yields a well-formed URL pointing at nothing. So verify uploads by
fetching the image, not by reading the column.

A second, separate trap: `onInit` returns early when the Cloudinary keys are
missing, and `generateURL` used to assume it had run — so a server started
*before* the keys were added would upload successfully (`handleUpload`
configures on the way through) while producing an unusable URL. `generateURL`
and `staticHandler` now call `ensureCloudinary()` themselves. **After changing
anything in `.env`, restart the CMS**: a running server holds the old
environment.

⚠️ **Payload's file route answers `GET` but not `HEAD`** (404). Verifying an
upload with `curl -I` or `fetch(url, {method:'HEAD'})` reports a missing file
that is actually there. Use a `GET`.

## The gallery page: three tabs

`/gallery` carries तस्वीरें (default), आलोक की आवाज़ें and चलचित्र.

| tab | source | stored |
|---|---|---|
| तस्वीरें | `gallery` collection | Cloudinary |
| आलोक की आवाज़ें | the **same `audio` collection** posts use | Cloudinary |
| चलचित्र | `videos` collection | **just a URL** |

- **All three panels are built at build time**; the tabs show and hide. Nothing
  is fetched on click, and with JavaScript off the reader loses the tabs, not
  the content.
- **The recordings tab is not a second collection.** A recitation uploaded for a
  poem appears here too — uploading it twice would be the obvious alternative
  and the wrong one.
- **`videos` holds a link, not a file.** A phone video is routinely 100MB+ and
  Cloudinary's free tier is ~25GB total; these videos already live on YouTube or
  Instagram. `fields/video-url.ts` shares one loose validator with `Posts.videoUrl`
  — the real parsing stays in `utils/embeds.ts`, so the CMS never rejects a link
  the site can handle.
- The tab is written to the URL hash, so `/gallery#chalchitra` opens on चलचित्र.

## Audio and video on a post

A post can carry a recitation and one video. Both optional, both independent.

| | Field | Stored |
|---|---|---|
| आवाज़ | `audio` → the `audio` collection | Cloudinary |
| वीडियो | `videoUrl` — one text field | just the URL |

- **One URL field, not one per platform.** `utils/embeds.ts` works out YouTube
  vs Instagram from the link itself, so the author pastes what they copied
  rather than classifying it. It handles `watch?v=`, `youtu.be`, `/shorts/`,
  `m.youtube.com`, `/reel/`, `/reels/`, `/p/`, and strips tracking params.
- **An unrecognised URL renders nothing** and the layout stays single-column —
  the URL is parsed in `PostLayout` too, so a bad link never widens the page
  into an empty rail.
- **Cloudinary files audio under `resource_type: 'video'`.** There is no audio
  type. `lib/cloudinary-adapter.ts` derives it from the filename, because
  `handleDelete`/`generateURL` get a filename but no mime type — get it wrong
  and deletes silently leave the file on the account.
- **The two platforms keep different aspect ratios** — 16:9 for YouTube, 9:16
  for a reel. Forcing one on both letterboxes the other into a strip.
- The rail is **sticky above 68rem only**; when the layout stacks, sticky would
  pin a video over the poem.
- **A post with no media renders exactly as before**, single column at the site's
  40rem measure. Only a post *with* media widens to 58rem — most posts are text
  alone and must not pay for a feature they do not use.

⚠️ When testing this, grep the **markup**, not the page: Astro inlines the
scoped CSS, so `has-media` and `media-rail` appear in every post's `<style>`
block whether or not the post has media. Strip `<style>` first or you will
diagnose a bug that is not there.

## Likes, share and comments

All three run **in the browser** against the CMS API, so the site stays fully
static — no adapter, no server, and no per-reader database hit on page load. If
the CMS is unreachable the poem still renders; only these degrade.

| | Where | Notes |
|---|---|---|
| Like | `POST /api/posts/:slug/like` | Public. **Rate-limited 10/min per IP** in `endpoints/like-post.ts` |
| Count | `GET /api/posts/:slug/likes` | Fetched on load — the built-in number is stale the moment anyone else taps |
| Comments | `GET/POST /api/comments` | Public create; **pre-moderated** |
| Share | none | WhatsApp, native share sheet, copy link — pure client |

Things worth knowing before changing any of it:

- **The like rate limit is in-memory.** It resets on restart and each instance
  counts alone. Right for a personal blog; if likes ever matter, move the
  counting into the database with a per-visitor row.
- **`localStorage` is not the like control.** It only stops the same browser
  double-tapping and seeing a confusing count. The real limit is the server's.
- **Comments are approved before they appear**, enforced in the CMS. The form
  says so explicitly — otherwise a reader assumes it broke and submits again.
- **Never build comment HTML with `innerHTML`.** The list is assembled with
  `textContent`; it is a stranger's input.
- `authorEmail` is collected but **never returned by the public API** (verified).
- The form has a honeypot field rather than a captcha — free for a human, and
  most bots fill every input they find.
- Comments query by **numeric post id**, not slug, so `Post.cmsId` exists
  alongside `Post.id` (which stays the slug, because every URL is built on it).

⚠️ **Do not test Devanagari input with `curl` on Windows** — the shell mangles
it to `????` before the request is sent, which looks exactly like a database
encoding bug. Post from Node with `fetch` instead; UTF-8 round-trips correctly
(verified end to end).

## Poem autofill (Claude)

The "कविता से भरिए" panel at the top of the post editor takes a pasted poem and
fills title, slug, excerpt, category, date and body. Needs `ANTHROPIC_API_KEY`
in the root `.env`; without it the panel returns a clear error rather than
failing silently.

- **Endpoint:** `POST /api/draft-from-poem` (`src/endpoints/draft-from-poem.ts`),
  staff-only. **UI:** `src/components/PoemAutofill.tsx`, mounted as a `ui` field.
- **Model `claude-haiku-4-5`**, structured outputs via `messages.parse()` + a Zod
  schema — so there is no JSON parsing and no retry loop. The single source of
  truth is `model:` in `draft-from-poem.ts`; nothing else depends on the choice,
  so switching is a one-line change.

  ⚠️ **Do not add `effort` while on Haiku 4.5** — it rejects the parameter and
  every request 400s. It was set to `medium` under Sonnet 5 and had to be removed
  with the switch. Restore it if you move back to a Sonnet or Opus model.

  *Model history:* built on `claude-opus-5`, moved to `claude-sonnet-5` when Opus
  was returning `529 overloaded` (capacity on Anthropic's side, never the key),
  then to Haiku 4.5 by choice. All three were tested on the same real post; Haiku
  matched Sonnet exactly — same slug, same category, same segment classification
  — in **17s rather than 23s** and at roughly a third of the cost. Reasonable,
  because this job is transliteration and classification, not reasoning.

  One difference worth watching: Haiku writes the **excerpt** as a summary,
  where the prompt asks for lines drawn from the opening. Harmless, but it is
  the first place quality will drift if you push this model harder.
- **Claude returns classified segments, never Lexical JSON.** It decides which
  lines are verse, quoted lyric, centred, or prose; `src/lib/lexical-nodes.ts`
  builds the actual nodes. Asking a model for Lexical directly means trusting it
  to get `format`/`indent`/`version` right on every node, where one bad field
  breaks the editor.
- **Deterministic work stays in code:** the Hindi date, sort order, slug
  sanitising and uniqueness. Claude only supplies the *transliteration*.
- **Those node builders are shared** with `scripts/migrate-markdown.ts`. Both
  paths must emit identical structures — change one, check the other, and keep
  both in step with `packages/shared/src/lexical.ts`, which renders them back to
  HTML.
- The panel **never silently overwrites**: if the form already has a title or
  body it asks before replacing.

⚠️ Re-running `migrate:markdown` sets `_status` from each file's frontmatter, so
it will **re-publish the guide post** that was deliberately set to draft. Set it
back afterwards.

## The author's name: the `identity` global

The name showed up in four places on the homepage — hero byline, portrait `alt`,
portrait heading, and the footer `©` line — all hardcoded in
`apps/web/src/data/site.ts`. Changing it meant editing code, which put it out of
reach of the person whose name it is.

It now lives in a Payload **global**, `identity` (`/admin` → परिचय), holding
byline, role, bio, signature, portrait caption, portrait datestamp, handle, an
optional copyright line, and the homepage's **two pictures** — the hero
background and the polaroid portrait. `apps/web/src/utils/identity.ts` reads it
at build time; `Hero.astro` and `SiteFooter.astro` are the only consumers.

### The two images

- **They point at `media`, not `gallery`** — same split that keeps post covers
  out of the public grid. A background photo is page furniture, not an exhibit.
- **Both optional.** Empty → the site uses `src/assets/kite-sky.jpg` and
  `src/assets/alok-portrait.jpg` exactly as before, so those files are live
  fallbacks and must not be deleted.
- **Two different resizers, on purpose.** Bundled assets go through Astro's
  `getImage()` at build time; CMS images are resized by rewriting the Cloudinary
  URL (`cloudinaryVariant`, shared with the gallery). Routing Cloudinary images
  back through Astro would re-download and re-encode what a CDN already serves
  correctly, and would need `image.domains` opened up.
- **`c_limit`, never `c_fill`** — Cloudinary is not allowed to crop. `.frame`
  has `aspect-ratio: 4/5` with `object-fit: cover`, so the browser decides the
  crop. Server-side cropping would silently cut faces.
- The portrait is a plain `<img>`, not `<Image>`, because the src may be remote.
  That is also why the CSS is `.frame img` and no longer `.frame :global(img)`.
- **The identity fetch asks for `?depth=1`.** `defaultDepth` is 0 project-wide;
  at depth 0 both uploads arrive as bare ids and the homepage silently keeps the
  bundled pictures — which looks like "the upload didn't work", not like a bug.

- **A global, not a collection.** There is one author. A collection would show
  an "add new" button and a list, leaving the publisher to guess which row the
  site uses.
- **`read` is public** — the static build fetches it unauthenticated. Nothing in
  it is private; every field is printed on the homepage.
- **Copyright is derived.** Leave the field blank and the footer renders
  `© <byline>`, so the name reaches it too. That second hardcoded copy of the
  name is precisely what this removed. An explicit value still wins.
- **Saving triggers a rebuild**, via `revalidateGlobal()` in
  `hooks/revalidate-site.ts` — the same path a published post takes. Without it
  a changed name would sit in Postgres and never reach a reader.
- **Unlike `utils/posts.ts`, this does not fail the build** when the CMS is
  unreachable. Missing poems mean an empty site and must stop a build; a missing
  name only means a stale one, so it warns and falls back.

⚠️ **The values still in `site.ts` are fallbacks, not the source.** Editing them
to change the name leaves the CMS and the code silently disagreeing — whichever
the build reads wins. Change it in `/admin`.

⚠️ **`site.description` still contains the name** (`"… आलोक कुमार सिंह।"`) and
feeds `<meta name="description">` and `og:description` on every page. It is a
sentence rather than a name field, so it was left in code — but a rename has to
touch it by hand, or move it into the CMS as a site-settings field.

## The contact page: the `contact` global

`/contact` used to be three rows hardcoded in `apps/web/src/data/site.ts` —
adding a fourth platform meant editing code and redeploying. The page now comes
from a second global, `contact` (`/admin` → संपर्क): heading, subheading, a
drag-orderable **rows** array, and a closing line.
`apps/web/src/utils/contact.ts` reads it at build time; `contact.astro` fetches
once and passes the rows to `ContactCard.astro`.

Each row is `label`, `text`, `href`, plus an optional `buttonLabel` /
`buttonHref` (the button appears only when a label is typed; a blank button link
falls back to the row's).

- **The author never types a URL scheme.** The CMS validator is deliberately
  loose — it rejects only spaces and a bare `https://` — and `utils/contact.ts`
  normalises: a bare email gets `mailto:`, a schemeless domain gets `https://`,
  `/path` and `#anchor` are left alone. Requiring `mailto:` in the admin would
  be asking the publisher to know what a scheme is.
- **`external` is derived from the scheme, never typed.** A checkbox for it
  would either open a blank tab for `mailto:` or navigate the reader off the
  site, depending on which way the author got it wrong.
- **An empty `rows` array is honoured; an unreachable CMS is not.** The
  fallback in `site.ts` applies only when the fetch itself failed. Falling back
  on an empty array would mean deleting a row silently does nothing — the worst
  of the three outcomes. With no rows the card is not rendered at all, since an
  empty bordered box reads as broken rather than deliberate.
- **Rows missing a `label` or `href` are skipped**, same as the gallery skips
  url-less rows — a half-filled row should not become a dead link.
- The array uses a custom **`RowLabel`** (`components/ContactRowLabel.tsx`) so
  collapsed rows say "Instagram" rather than "पंक्तियाँ 02". ⚠️ It resolves
  through the import map — renaming it needs `npm run generate:importmap`, and
  forgetting fails at runtime, not at build time.
- `note` falls back to `''`, not to the built-in sentence: it is decoration, and
  an author who clears it means to clear it. The heading and subheading do fall
  back, because a page with no title is broken.

⚠️ **The footer's social links are still `socials` in `site.ts`** and did not
move. They are a different list with a `live` flag for the not-yet-existing
Facebook page, so a platform added in `/admin` appears on `/contact` but not in
the footer. Worth unifying if the two ever have to agree.

## Gotchas worth knowing

- **`turbopack.root` must be the repo root**, not `apps/cms`. npm hoists `next`
  into the root `node_modules`, and the Payload template's default points at the
  app directory, which breaks the build outright.
- **Slugs are typed by hand, never generated.** Titles are Devanagari, and
  slugifying "कुछ पाया कुछ छूट गया" yields empty or percent-encoded junk. Existing
  posts use hand-picked romanisations.
- **`displayDate` is a string on purpose.** "1 अगस्त 2026" is not JS-Date-parseable,
  so it is stored and rendered verbatim. Sorting uses `publishedAt` and `order` —
  never parse `displayDate`.
- **Comments are pre-moderated.** New ones land as `pending`; the public API only
  ever returns `approved`. Both field-level access and a `beforeValidate` hook pin
  this, so a crafted POST cannot self-approve.
- **Uploads go to Cloudinary**, not to disk — see the section above.
- **Poems are a `verse` block, not raw HTML.** Lexical has no raw-HTML node, so
  the old `<div class="verse">` markup became a real editor block: the author
  types plain lines, a blank line starts a new stanza. `packages/shared/src/lexical.ts`
  renders it back to the original `.verse`/`.stanza` markup so the CSS is unchanged.
- **Quoted song lines are blockquotes**, rendered as `<p class="lyric">`. Centred
  lines are paragraphs with Lexical's `center` alignment, rendered as `<p class="center">`.
- **The Lexical→HTML renderer is ours**, not Payload's. Using Payload's converter
  would drag React into a static site and emit generic tags, losing the site's
  existing classes. It escapes all text, which matters because posts can contain
  example markup as literal content.

## Documentation

- Payload: https://payloadcms.com/docs
- Astro: https://docs.astro.build
  - [Routing, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
  - [Astro components](https://docs.astro.build/en/basics/astro-components/)
  - [Content collections](https://docs.astro.build/en/guides/content-collections/)
  - [Styling](https://docs.astro.build/en/guides/styling/)
