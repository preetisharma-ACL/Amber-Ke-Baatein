# अम्बर की बातें

आलोक कुमार सिंह की कविताएँ, संस्मरण और कुछ अधूरी बातें।
Poems and memoir by Alok Kumar Singh — a Hindi literary site with its own CMS.

रचनाएँ अब `/admin` से लिखी और छापी जाती हैं। साइट स्थिर (static) रहती है, इसलिए
पढ़ने वाले को कभी database का इंतज़ार नहीं करना पड़ता।

Writing happens in an admin panel; the public site stays static, so a reader
never waits on a database.

---

## ढाँचा / What is in here

npm-workspaces monorepo — दो चलने वाले app, एक साझा package.

```
apps/web          Astro 7   — the public site (static)
apps/cms          Payload 3 on Next.js 16 — admin panel + REST/GraphQL API
packages/shared   types and constants both apps import
```

| | |
| --- | --- |
| सामग्री / content | **Neon Postgres** — Payload owns the schema |
| तस्वीरें, आवाज़ / uploads | **Cloudinary** — never local disk |
| भरने में मदद / autofill | **Claude** (`claude-haiku-4-5`) turns a pasted poem into a filled form |

साइट build के वक़्त CMS से रचनाएँ पढ़ती है — इसीलिए **साइट बनाने के लिए CMS का
चलना ज़रूरी है**. The site fetches from the CMS at build time, so the CMS must be
running to build the site.

---

## चलाने के लिए / Running it

सब कुछ repo की जड़ से चलाइए — किसी app के अंदर `npm install` मत कीजिए, वह
workspace hoisting से टकराता है.

Run everything from the repo root. Never `npm install` inside an app; it fights
the workspace hoisting.

```bash
cp .env.example .env    # भरिए / fill it in — see below
npm install
npm run dev             # दोनों एक साथ / both apps
```

| कमांड / command | क्या करता है / what it does |
| --- | --- |
| `npm run dev` | दोनों app / both apps together |
| `npm run dev:web` | सिर्फ़ Astro → http://localhost:4321 |
| `npm run dev:cms` | सिर्फ़ Payload → http://localhost:3456/admin |
| `npm run build` | पहले cms, फिर web / cms first, then web |
| `npm run check` | टाइप जाँच / typecheck (`astro check`) |
| `npm run generate:types` | Payload के types दोबारा बनाइए / regenerate `payload-types.ts` |

**CMS 3456 पर चलता है, 3000 पर नहीं** — इस मशीन पर 3000–3111 दूसरे projects ने
घेर रखे हैं. The CMS runs on **3456** because 3000–3111 are taken by other
projects on the original machine; to move it, change both
`apps/cms/package.json` and the root `.env`.

---

## नई रचना कैसे जोड़ें / Adding a poem

`/admin` खोलिए और लिख दीजिए। **कोई फ़ाइल नहीं बनानी।**

Open `/admin` and write. No files, no deploy, no code.

सबसे ऊपर **"कविता से भरिए"** का खाना है — कविता चिपकाइए, Claude शीर्षक, पता,
झलक, श्रेणी, तारीख़ और पूरा शरीर भर देता है। बदलना हो तो हाथ से बदल लीजिए।

The **"कविता से भरिए"** panel at the top of the post editor takes a pasted poem
and fills in the title, slug, excerpt, category, date and body. Everything
remains editable afterwards; it never overwrites a filled-in form without
asking.

> ⚠️ `apps/web/src/content/posts/` की markdown फ़ाइलें **मरी हुई हैं**. They were
> the source before the migration and are kept only as a backup. Editing them
> changes nothing.

छापने के बाद रचना साइट पर अपने आप पहुँच जाती है — dev में सीधे, production में
`SITE_DEPLOY_HOOK_URL` से. Publishing triggers a rebuild via a hook, so a
published post reaches the static site on its own.

---

## पर्यावरण / Environment

एक ही `.env`, repo की जड़ में, दोनों app पढ़ते हैं। हर app के लिए अलग `.env` मत
बनाइए — secret दोनों जगह अलग-अलग हो जाएगा.

One `.env` at the repo root, read by both apps. Do not add per-app `.env` files;
the values would drift apart. `.env.example` is the committed template and lists
every variable with a note on where to get it.

`.env` कभी commit नहीं होता / `.env` is gitignored and has never been committed.

---

## और पढ़ने के लिए / Further reading

| | |
| --- | --- |
| [`PROJECT.md`](PROJECT.md) | यह साइट क्या है और क्यों — तकनीकी और ग़ैर-तकनीकी, दोनों तरह से / what this project is and why, for both audiences |
| [`CLAUDE.md`](CLAUDE.md) | बनाने वालों के लिए — जाल, फ़ैसले, और उनकी वजहें / working notes: the traps, the decisions and the reasons behind them |

`CLAUDE.md` में वे बातें हैं जो code पढ़कर पता नहीं चलतीं — मसलन database दूसरे
महाद्वीप पर है और हर SQL round trip ~280ms लेता है, इसलिए index लगाने से कुछ
नहीं होगा.

`CLAUDE.md` records what the code cannot tell you — for instance that the
database is on another continent and every round trip costs ~280ms, which is why
adding indexes would not help.
