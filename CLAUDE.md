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

## Publishing a post does not put it on the site

The site is static. `getStaticPaths` in `posts/[slug].astro` decides which post
pages exist, and **Astro caches its result for the life of the dev server**,
re-running it only when that file changes.

So after publishing in the CMS you get a confusing split: the post appears on
the homepage and `/posts` immediately (those call `getPosts()` per request), but
its own page 404s. That is not a bug in the post — the page has not been
created yet.

```
npm run refresh:web     # touches [slug].astro; paths recompute in ~2s
```

For production, a new post needs `npm run build` — there is no live rendering.
Before deploying, wire a rebuild to publishing (a Payload `afterChange` hook on
Posts hitting a deploy hook), or the author will publish into silence.

**`export const prerender = false` does not fix this.** The site is
`output: 'static'` with no adapter, so Astro has nowhere to render on demand and
the export is ignored. Serving post pages live would mean adding an adapter and
a Node server, and with the database ~300ms away that puts roughly 600ms on
every reader's page load to save the author one rebuild — the wrong trade for a
blog that is read far more often than it is written to.

## Poem autofill (Claude)

The "कविता से भरिए" panel at the top of the post editor takes a pasted poem and
fills title, slug, excerpt, category, date and body. Needs `ANTHROPIC_API_KEY`
in the root `.env`; without it the panel returns a clear error rather than
failing silently.

- **Endpoint:** `POST /api/draft-from-poem` (`src/endpoints/draft-from-poem.ts`),
  staff-only. **UI:** `src/components/PoemAutofill.tsx`, mounted as a `ui` field.
- **Model `claude-opus-5`**, structured outputs via `messages.parse()` + a Zod
  schema, so there is no JSON parsing or retry loop. Effort `medium` — this is
  classification and transliteration, not deep reasoning.
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
- **Uploads go to local disk** (`apps/cms/media/`). Serverless hosts have an
  ephemeral filesystem — switch to S3/R2 storage before deploying.
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
