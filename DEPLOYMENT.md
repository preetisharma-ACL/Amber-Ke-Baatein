# Deploying अम्बर की बातें

**Audience:** an agent or engineer doing the deployment, who has not seen this
codebase. Everything needed is in this file — you should not have to read the
source to get it live.

**Repo:** `https://github.com/preetisharma-ACL/Amber-Ke-Baatein` (branch `main`)

---

## 0. The one thing that will bite you

**The public site is static and fetches all its content from the CMS at build
time.** So:

```
Deploy the CMS first  →  get its public URL  →  only then build the site.
```

If you build the site while the CMS is unreachable, the build **fails loudly**
with `could not reach the CMS at <url>` (this is deliberate — it refuses to
publish an empty site). That is the correct behaviour, not a bug to work around.

A second consequence: `PUBLIC_CMS_URL` is **baked into the built HTML/JS** (the
like button and the comment form read it from a `data-cms` attribute). If the
CMS URL ever changes, the site must be **rebuilt**, not just reconfigured.

---

## 1. What this is

An npm-workspaces monorepo containing two independently deployable apps plus one
shared source-only package.

```
apps/web          Astro 7          → the public static site
apps/cms          Payload 3 on Next.js 16 → /admin panel + REST & GraphQL API
packages/shared   raw .ts types + the Lexical→HTML renderer (NO build step)
```

| Concern | Service |
|---|---|
| Content / database | **Neon Postgres** (already provisioned, `us-east-2`) |
| Uploads (photos, cover images, recitations) | **Cloudinary** (never local disk) |
| Admin autofill panel | **Anthropic API** (`claude-haiku-4-5`) — optional |

- Node **>= 22.12** (`engines` in every package.json). Use Node 22.x.
- npm workspaces. `package-lock.json` is committed → `npm ci` works.
- Root `.npmrc` sets `legacy-peer-deps=true`. **Payload will not install without
  it.** Any install must run from the repo root so this file is read.

### Ports in development (irrelevant in production, but explains the defaults)

CMS on **3456**, site on **4321**. The 3000–3111 range was occupied on the
original dev machine. In production the CMS listens on `$PORT` like any Next app.

---

## 2. Target architecture

Two separate deployments:

| | What | Type | Suggested host |
|---|---|---|---|
| **CMS** | `apps/cms` | Long-running Next.js server (SSR + API) | Vercel (easiest), Railway, Render, Fly.io |
| **Site** | `apps/web` | Pure static files | Netlify, Vercel, Cloudflare Pages |

They may live on different hosts — that is fine and expected. Suggested domains:

```
https://ambarkibaatein.com          → the Astro site   (public)
https://cms.ambarkibaatein.com      → the Payload CMS  (admin + API)
```

The CMS origin **is** publicly reachable by design: the browser calls it directly
for likes and comments, and Cloudinary URLs bypass it entirely for images.

---

## 3. Environment variables

There is **one `.env` at the repo root**, read by both apps (Astro via Vite's
`envDir: '../../'`, the CMS via `dotenv` in `next.config.ts` and
`payload.config.ts`). It is **gitignored and must never be committed**.
`.env.example` is the committed template.

In production, set these in each host's dashboard instead. `dotenv` never
overwrites an already-set variable, so real environment variables always win —
and if the `.env` file is absent (it will be), loading it is a harmless no-op.

**Do not create per-app `.env` files.** The secret would drift between the two.

### 3.1 CMS deployment — required

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon connection string | **Reuse the existing one from the local `.env`.** See §3.4 before considering a new database. |
| `PAYLOAD_SECRET` | 32-byte hex | **Reuse the existing value.** Changing it invalidates every login session and every existing auth token. Generate a fresh one only for a fresh database: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PAYLOAD_PUBLIC_SERVER_URL` | `https://cms.ambarkibaatein.com` | The CMS's own public origin. |
| `PUBLIC_SITE_URL` | `https://ambarkibaatein.com` | ⚠️ **This is what the CMS puts in its CORS and CSRF allowlists.** Get it wrong and likes/comments fail in the browser with a CORS error while everything else looks fine. No trailing slash. |
| `CLOUDINARY_CLOUD_NAME` | from Cloudinary dashboard | |
| `CLOUDINARY_API_KEY` | from Cloudinary dashboard | |
| `CLOUDINARY_API_SECRET` | from Cloudinary dashboard | |
| `NODE_ENV` | `production` | Usually set by the host automatically. |

### 3.2 CMS deployment — optional but strongly recommended

| Variable | Value | If omitted |
|---|---|---|
| `SITE_DEPLOY_HOOK_URL` | The static site host's build hook URL | ⚠️ **A published post never reaches the live site.** The CMS logs a warning and carries on. See §6. |
| `ANTHROPIC_API_KEY` | Anthropic console API key | The "कविता से भरिए" autofill panel in the post editor returns a clear error instead of working. Everything else is unaffected. |

### 3.3 Static site deployment

| Variable | Value | Notes |
|---|---|---|
| `PUBLIC_CMS_URL` | `https://cms.ambarkibaatein.com` | **Build-time and baked into the output.** No trailing slash. Change it → rebuild. |

The site does **not** need `DATABASE_URL`, `PAYLOAD_SECRET`, or any Cloudinary
credential. It only talks to the CMS over HTTP. Do not copy secrets into it.

`PUBLIC_SITE_URL` is not read by the Astro build — the canonical/`og:url` origin
comes from `site:` in `astro.config.mjs` (see §5.1).

### 3.4 ⚠️ Migrations: `migrate:create` cannot be trusted blindly here

Production and development now use **separate databases**, so schema changes
travel as migrations in `apps/cms/src/migrations/`.

The trap, learned the hard way: **`payload migrate:create` diffs against the
previous *snapshot*, not against the live database.** This project spent its
early life on dev-push with no snapshot at all, so the first `migrate:create`
emitted the *entire* schema — every `CREATE TABLE`, and a `down()` that drops
every table including all posts. On a production database restored from a dump,
that `up()` fails on the first `CREATE TYPE` and that `down()` is a loaded gun.

So, after any schema change:

1. Run `npm run payload -- migrate:create <name>` from the repo root.
2. **Read the generated `.ts` before committing it.** It should contain only
   your change. If it contains the whole schema, the snapshot baseline was
   missing — rewrite `up()`/`down()` by hand to the actual delta and keep the
   generated `.json` snapshot, which becomes the baseline for next time.
3. Test it against a scratch database, or inside a transaction you roll back.
4. Apply on the server with `npm run payload -- migrate` (see §9).

`payload migrate` does **not** run automatically on boot — it is a deliberate,
separate step, and the CMS will start happily against a database missing the
table and fail only when something reads it.

### 3.5 About the database

The existing Neon project already holds **all the content: posts, categories,
gallery rows, version history, and the admin user account.**

**Reuse the same `DATABASE_URL` in production.** A fresh Neon project is empty —
Payload will push the schema on first connect, but you would get a CMS with no
posts and *no way to log in*.

If you must move databases, note that only a **region change** buys anything.
The DB is in AWS `us-east-2`; every SQL round trip from India measures ~280ms and
that dominates everything. Swapping projects within the same region was already
tried and measured identically. Verify with
`npm run measure:db --workspace @amber/cms` before assuming a move helped.

A `-pooler` host (Neon's PgBouncer) works fine and is what the current URL uses.

Keep `sslmode=require` in the connection string.

---

## 4. Deploying the CMS (`apps/cms`)

### 4.1 Vercel (recommended path)

Create a **new Vercel project** from the GitHub repo.

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root Directory | `apps/cms` — and enable **"Include files outside of the Root Directory"** |
| Install Command | leave default (Vercel detects npm workspaces and installs from the repo root, which is required so the root `.npmrc` is honoured). If the install fails on peer deps, set it explicitly to `npm ci --legacy-peer-deps` run from the repo root. |
| Build Command | leave default (`npm run build` in `apps/cms`) |
| Node.js version | 22.x |

Then add every variable from §3.1 and §3.2 to Vercel → Settings → Environment
Variables (Production, and Preview if you use previews).

Deploy. The CMS is live at `https://<project>.vercel.app`; attach the custom
domain `cms.ambarkibaatein.com`, then **go back and set
`PAYLOAD_PUBLIC_SERVER_URL` to the final custom domain and redeploy** — it was
probably pointing at the `.vercel.app` URL on the first pass.

Things already handled in `next.config.ts`, so do not "fix" them:

- `transpilePackages: ['@amber/shared']` — the shared package ships raw
  TypeScript with no build step, so Next must compile it.
- `turbopack.root` is pinned to the **repo root**. npm hoists `next` into the
  root `node_modules`; the Payload template's default of `apps/cms` breaks the
  build outright.
- `redirects()` sends `/` → `/admin`. The bare CMS origin is not a website.

Build memory: the build script sets `--max-old-space-size=8000`. Payload's admin
bundle is large. If the build OOMs on a memory-limited host, that number is the
first thing to look at.

### 4.2 Railway / Render / Fly.io (container or buildpack)

Equivalent settings:

```
Install:  npm ci                 # from the REPO ROOT — the .npmrc lives there
Build:    npm run build:cms      # from the repo root
Start:    npm run start --workspace @amber/cms
```

⚠️ The start script hardcodes `--port 3456`. If the host injects `$PORT` and
expects the app to bind it, change `start` in `apps/cms/package.json` to
`next start` (Next reads `$PORT`), or set the host's port to 3456.

⚠️ **The committed `apps/cms/Dockerfile` does not work as-is.** Its own header
says it requires `output: 'standalone'` in the Next config, and that is **not
set**. It also assumes a single-app repo (`COPY package.json ...` at the root)
rather than this workspace layout. If you want Docker, you must add
`output: 'standalone'` to `next.config.ts` and rewrite the Dockerfile for npm
workspaces. Prefer a buildpack host unless you have a reason not to.

### 4.3 After the CMS is up — verify before touching the site

1. Open `https://cms.ambarkibaatein.com/admin` → you get the Payload login.
2. Log in with the existing admin account (it lives in the Neon DB you reused).
   - If you see the **"create first user"** screen instead, you are pointed at an
     **empty database**. Stop and fix `DATABASE_URL`. Do not create a user and
     carry on — you would be publishing an empty site.
3. `curl https://cms.ambarkibaatein.com/api/posts?limit=1` → JSON with `docs`.
   Expect ~600ms; that is the Neon distance, not a fault.
4. Open a post in the admin and confirm the cover image renders, and open
   `/admin/collections/gallery` and confirm thumbnails render.
5. **Confirm images actually load from Cloudinary** — see §7.1. Check the
   network tab, not the database column; the column is not what gets served.

---

## 5. Deploying the static site (`apps/web`)

**Only after the CMS is live and step 4.3 passes.**

### 5.1 Set the canonical domain first

`apps/web/astro.config.mjs` hardcodes:

```js
site: 'https://ambarkibaatein.com',
```

This is the origin used for `<link rel="canonical">` and `og:url` on every page.
**If you are deploying to any other domain, edit this line and commit**, or every
page will advertise the wrong URL. (It is not an env var on purpose — a build
without it would bake in the build server's `localhost`.)

### 5.2 ⚠️ What is actually deployed today: nginx on a VPS

**Read this before following §5.3–5.5.** Those sections describe hosts this
project *could* use. It is not on any of them.

Measured from outside on **10 Aug 2026**:

| | |
|---|---|
| `ambarkibaatein.com` | `server: nginx/1.24.0 (Ubuntu)` — static files from disk |
| `cms.ambarkibaatein.com` | the same nginx, reverse-proxying the Payload/Next server |
| Every file's `Last-Modified` | one identical timestamp — the whole `dist` was copied up in one batch |
| `/_astro/*` | `cache-control: max-age=2592000, public, immutable` |

**The consequence that costs the most time:** nothing rebuilds this site. There
is no CI in the repo — no `.github/workflows`, no `netlify.toml`, no
`vercel.json` — and a plain nginx box has no build hook. **`git push` does not
change the live site.** Neither does publishing a post.

This has already caused one confusing afternoon. On 7 Aug the site was built and
uploaded at 18:13 IST; commit `b8a1b6c`, which restyled the post share buttons,
landed at 18:56 IST. For three days the change was on `main`, worked locally, and
was invisible live — while CMS-only commits made the same week *did* appear,
because the CMS is a running server that gets redeployed. The natural reading is
"my push half-worked". Nothing had half-worked: two deployments, only one of them
current.

**A useful first check when a change is missing live:** compare the page's
`Last-Modified` against the commit's date.

```bash
curl -sI https://ambarkibaatein.com/ | grep -i last-modified
git log -1 --date=iso --pretty='%ad %s' -- apps/web
```

If the commit is newer than the file, nothing is broken — the site was never
rebuilt. Also worth knowing which app a commit touched, since only `apps/web`
needs this rebuild:

```bash
git show --stat --pretty='' <sha>
```

#### Deploying the site by hand

```bash
# 1. Build with the PRODUCTION urls. ⚠️ The root .env holds localhost values and
#    PUBLIC_CMS_URL is baked into the HTML as data-cms — build without these and
#    every like button and comment form on the live site points at localhost and
#    silently fails. Real environment variables win over .env, so prefixing works.
PUBLIC_CMS_URL=https://cms.ambarkibaatein.com \
PUBLIC_SITE_URL=https://ambarkibaatein.com \
npm run build:web

# 2. Verify before uploading — three seconds, and it catches the mistake above.
grep -rl localhost apps/web/dist   # must print nothing
grep -o 'data-cms="[^"]*"' apps/web/dist/posts/*/index.html | head -1

# 3. Copy apps/web/dist/* to whatever directory nginx serves (~21 files, ~930KB).
```

Uploading is a straight file copy — `rsync -av --delete apps/web/dist/ user@host:/var/www/<root>/`
once you know the host and document root. **Those two facts are not recorded
anywhere in this repo**; find them in nginx's config on the box
(`/etc/nginx/sites-enabled/`, look for the `root` directive of the
`ambarkibaatein.com` server block) and write them in here when you do.

`--delete` matters: `_astro` filenames are content-hashed, so without it every
build leaves its predecessors behind forever.

The immutable caching is safe on its own — a changed file gets a new hash and a
new name, so browsers fetch it. `index.html` files carry no `cache-control`, so
they revalidate.

#### Two things this setup does not do

1. **Publishing a post never reaches the site** (§6). There is no build hook to
   point `SITE_DEPLOY_HOOK_URL` at, so every publish needs the manual rebuild
   above. Fixing this properly means a GitHub Actions workflow that builds and
   rsyncs on push, plus a small authenticated endpoint the CMS can POST to.
2. **The CMS deploys separately**, and forgetting it is its own confusing
   failure: on 10 Aug the site was rebuilt with the new dynamic contact page
   while the CMS still ran older code, so `/api/globals/contact` returned 404 and
   the page quietly fell back to its built-in rows. That fallback is deliberate
   (`apps/web/src/utils/contact.ts`) and it is *why* nothing looked broken — but
   the new fields were not in `/admin` either. **Deploy the CMS first, then build
   the site.** Same order as §0.

### 5.3 Netlify

| Setting | Value |
|---|---|
| Base directory | *(empty — the repo root)* |
| Build command | `npm run build:web` |
| Publish directory | `apps/web/dist` |
| Environment | `PUBLIC_CMS_URL=https://cms.ambarkibaatein.com`, `NODE_VERSION=22` |

### 5.4 Vercel (as a second project)

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Root Directory | `apps/web` + **"Include files outside of the Root Directory"** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment | `PUBLIC_CMS_URL=...` |

### 5.5 Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build:web` |
| Build output directory | `apps/web/dist` |
| Environment | `PUBLIC_CMS_URL=...`, `NODE_VERSION=22.12.0` |

### 5.6 Notes that apply to all the hosted options

- Astro is `output: 'static'` with **no adapter**. Do not add one, and do not add
  `export const prerender = false` anywhere — with no adapter it is silently
  ignored. Serving post pages on demand would put ~600ms of Neon latency on every
  reader's page load to save the author one rebuild. That trade was considered
  and rejected.
- The build reaches out to the CMS over the public internet. If your host has
  egress restrictions, allow it.
- Only **published** posts are returned by the public API, so drafts cannot leak
  into a build.

---

## 6. Wire up the deploy hook (do not skip this)

⚠️ **As deployed today there is nothing to point this at** — the site is nginx on
a VPS, which has no build hooks. See §5.2: every publish currently needs a manual
rebuild. This section applies once the site moves to a host that offers one, or
once a CI workflow provides an equivalent URL.

The site is static. **A newly published post does not exist until the site is
rebuilt.** The CMS handles that automatically — but only if you give it a URL.

1. On the static-site host, create a build hook:
   - Netlify → Site settings → Build & deploy → Build hooks
   - Vercel → Settings → Git → Deploy Hooks
   - Cloudflare Pages → Settings → Builds → Deploy hooks
2. Copy the URL into the **CMS's** `SITE_DEPLOY_HOOK_URL` environment variable.
3. Redeploy the CMS so it picks up the variable.
4. Test end to end: publish or edit a post in `/admin`, confirm a build starts on
   the site host within a few seconds, and confirm the post appears when it ends.

Without this variable the CMS logs
`SITE_DEPLOY_HOOK_URL not set — "<slug> saved" will not appear on the built site`
and the author publishes into silence. `npm run refresh:web` is a local-only
fallback and does nothing in production.

The hook is fire-and-forget and every failure is caught: a broken webhook can
never block or lose a save.

---

## 7. Cloudinary — read this before first deploy

All uploads (gallery photos, post cover images, recitations) go to Cloudinary.
Local disk is disabled on the `gallery`, `media` and `audio` collections, because
disk does not survive a redeploy.

There is no official Payload Cloudinary adapter; `apps/cms/src/lib/cloudinary-adapter.ts`
is hand-written. Two behaviours matter for deployment:

### 7.1 Verify uploads by fetching them, not by reading the database

The `url` column in Postgres can hold a stale value, but **it is not what the API
serves**. Measured on this database (2026-08-07): `gallery` rows 1 and 2 store
`…/alok-kumar?_a=BAMAPqiu0` while the API returns `…/alok-kumar`. The plugin
rebuilds `url` on read from the collection prefix plus `filename`, so a stale —
or even a localhost — value in the column does not reach the site.

That makes this much less dangerous than it looks, but it moves the thing that
matters to **`filename`**: the regenerated URL is built from it, so a row whose
file never actually landed on Cloudinary still produces a perfectly well-formed
URL pointing at nothing.

**So verify before launch by fetching the images, not by inspecting columns.**
Open `/gallery` and a post with a cover image on the built site and confirm each
picture loads from `res.cloudinary.com` in the network tab. Anything 404ing must
be **deleted and re-uploaded** — rewriting the column will not help, because the
column is not what is read.

(The setting that makes this work is `disablePayloadAccessControl: true` on all
three collections. **Do not remove it** to "tighten access" — these hold public
photographs and cover images, nothing is being given up, and without it every
image is proxied through the CMS, which would make the static site depend on the
CMS at read time.)

### 7.2 Restart after changing credentials

A running CMS holds the old environment. **After changing anything in the
Cloudinary variables, redeploy/restart the CMS** — do not assume a config change
took effect.

### 7.3 Verifying an upload by hand

Payload's file route answers `GET` but **not `HEAD`** (it 404s). `curl -I` will
tell you a file is missing when it is there. Use a `GET`.

---

## 8. CORS, and the browser-side features

Three features run in the reader's browser against the CMS API: **like**,
**comments**, and **share** (share is pure client-side, no network).

`payload.config.ts` builds its CORS and CSRF allowlists from **`PUBLIC_SITE_URL`
only**. So:

- `PUBLIC_SITE_URL` on the **CMS** must exactly match the site's public origin —
  scheme included, no trailing slash.
- If you also serve the site from `www.` or from a preview domain and want likes
  and comments working there, that origin must be added to the `cors`/`csrf`
  arrays in `apps/cms/src/payload.config.ts` (they take an array). Otherwise the
  poem renders fine and only those two features fail.

Other facts worth knowing:

- **Comments are pre-moderated.** New ones save as `pending`; the public API only
  ever returns `approved`. Enforced by both field access and a `beforeValidate`
  hook, so a crafted POST cannot self-approve. Someone has to approve them in
  `/admin` — tell whoever is publishing.
- `authorEmail` is collected but never returned by the public API.
- The like endpoint is rate-limited to **10/min per IP, in memory**. It resets on
  restart, and on a serverless host each instance counts separately. That is
  acceptable for a personal blog; if likes ever matter, move the counting into
  the database.
- If the CMS is down, poems still render perfectly. Only likes and comments
  degrade. That is the intended failure mode.

---

## 9. Deployment order — the checklist

1. [ ] Confirm the production `DATABASE_URL` points at the **populated** Neon
       project, and that `PAYLOAD_SECRET` is the existing value.
2. [ ] Deploy the CMS with §3.1 variables set.
3. [ ] Attach `cms.ambarkibaatein.com`; update `PAYLOAD_PUBLIC_SERVER_URL` to it;
       redeploy.
4. [ ] Log into `/admin`. Confirm posts exist and you are **not** shown the
       create-first-user screen.
5. [ ] Verify images load from `res.cloudinary.com` in the network tab (§7.1).
6. [ ] Set `PUBLIC_SITE_URL` on the CMS to the final site origin. Redeploy.
7. [ ] Edit `site:` in `astro.config.mjs` if the domain is not
       `https://ambarkibaatein.com`. Commit.
8. [ ] Deploy the site with `PUBLIC_CMS_URL` pointing at the live CMS.
9. [ ] Attach `ambarkibaatein.com`.
10. [ ] Create a build hook on the site host → set `SITE_DEPLOY_HOOK_URL` on the
        CMS → redeploy the CMS.
11. [ ] Run the smoke test below.

### Smoke test on the live site

- [ ] Home page lists the three newest posts, in Devanagari, rendered correctly.
- [ ] `/posts` lists everything; `/category` filters.
- [ ] A post page opens; the poem's stanza formatting (`.verse` / `.stanza`) is
      intact; a post with audio shows a player and a post with a video shows the
      embed.
- [ ] `/gallery` shows all three tabs — तस्वीरें, आलोक की आवाज़ें, चलचित्र — and
      images load **from `res.cloudinary.com`** (check the network tab, not just
      that they appear).
- [ ] `/gallery#chalchitra` opens directly on the चलचित्र tab.
- [ ] The like button increments and survives a reload.
- [ ] Submitting a comment shows the "awaiting approval" message; the comment
      appears in `/admin` as `pending`; approving it makes it appear on the page
      after the next build.
- [ ] Publish a test post in `/admin` → a site build triggers automatically →
      the post's **own page** (`/posts/<slug>`) loads, not just the listing.
      Then delete the test post.
- [ ] `view-source` on a post: `<link rel="canonical">` points at the real domain,
      not `localhost`.

---

## 10. Traps specific to this codebase

Short list of things that look like bugs and are not, or that are easy to break.

- **Never `npm install` inside an app directory.** It fights workspace hoisting.
  Always from the repo root.
- **`packages/shared` has no build step.** It exports raw `.ts`. Both apps are
  configured to compile it (`noExternal` in Astro's Vite config,
  `transpilePackages` in Next). Do not add a build step "to fix" a resolution
  error — fix the consumer's config instead.
- **The markdown files in `apps/web/src/content/posts/` are dead.** They are a
  pre-migration backup. Editing them changes nothing on the site. Do not treat
  them as content or as a fallback.
- **Slugs are hand-written, never generated.** Titles are Devanagari and
  slugifying them yields junk. Do not add auto-slugging.
- **`displayDate` is a string** (`"1 अगस्त 2026"`) and is not JS-Date-parseable
  by design. Sorting uses `publishedAt` and `order`. Never parse `displayDate`.
- **Do not test Devanagari input with `curl` on Windows** — the shell mangles it
  to `????` before the request is sent, which looks exactly like a database
  encoding bug. Post from Node with `fetch` instead. UTF-8 round-trips correctly.
- **`next dev` is not a performance measurement.** `/admin` measures ~4s TTFB in
  dev vs ~14ms in a production build. Always measure a real build before
  concluding the admin is slow.
- **Indexes will not speed anything up.** ~99.7% of a query's time is network
  latency to Ohio. The `index: true` flags are there for future scale only.
- **Do not add `effort` to the Anthropic call** in `draft-from-poem.ts` while it
  is on `claude-haiku-4-5` — Haiku 4.5 rejects the parameter and every request
  400s.
- **Do not re-run `migrate:markdown` in production.** It sets `_status` from each
  file's frontmatter and will re-publish a guide post that was deliberately left
  as a draft.

---

## 11. Post-launch operations

**Publishing a post:** `/admin` → new post → optionally paste the poem into the
"कविता से भरिए" panel → Publish. The rebuild fires automatically. Nothing to run
by hand.

**Approving a comment:** `/admin` → Comments → set status to approved. It appears
on the site after the next build (any publish, or a manual build-hook trigger).

**Changing the author's name, bio or homepage pictures:** `/admin` → परिचय. The
name, role, bio, signature, portrait caption, footer handle and both homepage
images (hero background and polaroid portrait) live there, and saving triggers a
rebuild like publishing does. Leave the copyright field blank and the footer
derives `© <name>` automatically. The two images are optional — empty means the
site keeps using the pictures committed in `apps/web/src/assets/`, so **do not
delete those files**; they are the live fallback.

**Adding a staff account:** only an `admin` role user can create users; there is
no public signup. The `editor` role can write, publish and moderate but cannot
manage accounts.

**Forcing a rebuild:** hit the build hook URL with a `POST`, or press the host's
"Trigger deploy" button.

**Rotating `PAYLOAD_SECRET`:** logs everyone out. Fine to do; just expect it.

**Changing the CMS domain:** update `PAYLOAD_PUBLIC_SERVER_URL` on the CMS **and**
`PUBLIC_CMS_URL` on the site, then rebuild the site — the old URL is baked into
the shipped HTML.

---

## 12. Reference

- Existing project docs, all committed at the repo root:
  - `README.md` — how to run it locally
  - `PROJECT.md` — what the project is and why, for technical and non-technical readers
  - `CLAUDE.md` — the working notes: every trap and the reasoning behind it
  - `.env.example` — the committed env template, with a note on where each value comes from
- Payload: https://payloadcms.com/docs
- Astro: https://docs.astro.build
- Neon: https://neon.tech/docs
