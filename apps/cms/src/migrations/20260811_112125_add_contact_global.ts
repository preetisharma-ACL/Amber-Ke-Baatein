import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `contact` global के दो table / the two tables behind the संपर्क global.
 *
 * ── इस बार `migrate:create` पर भरोसा किया जा सका, और क्यों / why the generator
 *    could be trusted this time ──────────────────────────────────────────────
 * पिछली बार (identity) उसने पूरा schema उगल दिया था, क्योंकि तुलना के लिए कोई
 * snapshot था ही नहीं। अब `20260807_070543_add_identity_global.json` मौजूद है और
 * उसमें वही 17 table हैं जो production में हैं — इसलिए फ़र्क़ निकालने पर सिर्फ़ ये
 * दो नए table आए। फिर भी हाथ से जाँचा गया: नया snapshot पुराने से केवल
 * `contact` और `contact_rows` जोड़ता है, किसी पुराने table में एक अक्षर नहीं बदला।
 *
 * `migrate:create` diffs against the previous *snapshot*, not the live database.
 * Last time (identity) there was no snapshot, so it emitted the whole schema and
 * had to be rewritten by hand. This time the identity snapshot exists and
 * describes exactly the 17 tables production has, so the diff came out as these
 * two tables alone. Verified by hand anyway: the new snapshot adds only
 * `contact` and `contact_rows` and changes no existing table.
 *
 * ⚠️ snapshot की कड़ी नाम के क्रम से बनती है, `prevId` से नहीं / Payload picks the
 * baseline by taking the alphabetically last `.json` in this folder — it never
 * reads `prevId` (which drizzle always writes as the zero UUID). इसलिए इन
 * फ़ाइलों का नाम कभी ऐसा न रखिए जो पुरानी से पहले आता हो, वरना अगली बार का फ़र्क़
 * ग़लत आधार से निकलेगा।
 *
 * ── किस चीज़ का table / what these hold ───────────────────────────────────────
 * `contact` — पन्ने का शीर्षक, उपशीर्षक और नीचे की पंक्ति, एक ही row में।
 * `contact_rows` — ठिकानों की सूची (ईमेल, Instagram, …), `_order` से क्रम में।
 * देखिए globals/SiteContact.ts.
 *
 * ── बीज (seed) की ज़रूरत नहीं / no seed row needed ────────────────────────────
 * खाली table पर भी `findGlobal({ slug: 'contact' })` पूरा दस्तावेज़ लौटाता है —
 * Payload हर खाने का `defaultValue` लगा देता है, तीनों पंक्तियों समेत, और row
 * बनाता तक नहीं। यह नापकर देखा गया, माना नहीं गया (dev database में इस table की
 * एक भी row नहीं है और पन्ना ठीक चलता है)। पहली बार Save करने पर row बनती है।
 *
 * An empty table is a working state: `findGlobal` applies each field's
 * `defaultValue` when no row exists — heading, subheading, note and all three
 * rows — and does not insert anything. Measured, not assumed. The row appears
 * the first time the author saves.
 *
 * ── दोबारा चलाने पर भी सुरक्षित / safe to run twice ──────────────────────────
 * वही रुख़ जो identity वाली migration का है: अधूरा चला हुआ migration दोबारा
 * चलाया जा सके। Idempotent, like the identity migration, so a half-applied run
 * on a live server can simply be repeated.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "contact" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'संपर्क',
  	"subheading" varchar DEFAULT 'कुछ कहना हो तो',
  	"note" varchar DEFAULT 'कोई रचना अच्छी लगे तो बता दीजिएगा — लिखने वाले के लिए इतना ही बहुत होता है।',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE IF NOT EXISTS "contact_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"text" varchar,
  	"href" varchar NOT NULL,
  	"button_label" varchar,
  	"button_href" varchar
  );

  DO $$ BEGIN
   ALTER TABLE "contact_rows" ADD CONSTRAINT "contact_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "contact_rows_order_idx" ON "contact_rows" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "contact_rows_parent_id_idx" ON "contact_rows" USING btree ("_parent_id");`)
}

/**
 * सिर्फ़ ये दो table गिरती हैं / drops these two tables and nothing else.
 *
 * इनमें संपर्क के पन्ने का लिखा हुआ होता है — शीर्षक और ठिकानों की पंक्तियाँ।
 * रचनाएँ, टिप्पणियाँ, तस्वीरें, परिचय — कोई नहीं छूता। गिरने के बाद पन्ना टूटता
 * नहीं, `defaultValue` वाली वही तीन पंक्तियाँ लौट आती हैं (ऊपर देखिए)।
 *
 * This removes only the contact page's own content — its heading and its rows.
 * Posts, comments, uploads and the identity global are untouched. Note that
 * running this does not break the site: with the table gone the global falls
 * back to its `defaultValue`s, the same three rows the page shipped with.
 *
 * `contact_rows` पहले, क्योंकि उसकी foreign key `contact` पर टिकी है —
 * child first, since its foreign key points at `contact`.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "contact_rows" CASCADE;
  DROP TABLE IF EXISTS "contact" CASCADE;`)
}
