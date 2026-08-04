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
