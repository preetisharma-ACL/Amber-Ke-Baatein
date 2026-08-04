# ⚠️ ये फ़ाइलें अब साइट पर नहीं दिखतीं / these files are no longer live

**यहाँ कुछ बदलने से साइट नहीं बदलेगी।**
**Editing anything in this folder will NOT change the website.**

रचनाएँ अब Payload CMS (Neon Postgres) में रहती हैं। बदलाव यहाँ कीजिए:

Posts now live in the Payload CMS backed by Neon Postgres. Edit them at:

> http://localhost:3456/admin  →  रचनाएँ

ये markdown फ़ाइलें सिर्फ़ दो कारणों से रखी हैं:

These markdown files are kept only because:

1. **नक़ल के तौर पर / as a backup** of the pre-migration content.
2. **`migrate:markdown` इन्हीं को पढ़ती है** — the importer at
   `apps/cms/src/scripts/migrate-markdown.ts` reads this directory, so deleting
   it would break a re-run of the migration.

जब भरोसा हो जाए कि सब ठीक है, तो पूरा `src/content/` हटाया जा सकता है — git में
यह commit `0fd1e09` तक सुरक्षित है।

Once you are confident the migration is good, this whole `src/content/` folder
can be deleted; it is preserved in git up to commit `0fd1e09`.
