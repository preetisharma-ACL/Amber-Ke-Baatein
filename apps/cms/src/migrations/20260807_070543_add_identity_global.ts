import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `identity` global का table / the table behind the परिचय global.
 *
 * ── यह हाथ से लिखी गई है, और क्यों / hand-written, and why ────────────────────
 * `payload migrate:create` ने पूरा schema बनाया था — हर table, और `down()` में
 * हर table का `DROP`. वजह: यह पिछले snapshot से फ़र्क़ निकालता है, चल रहे database
 * से नहीं। इस project में migration कभी बना ही नहीं था, इसलिए इसके पास तुलना के
 * लिए कुछ नहीं था और उसने सब कुछ "नया" मान लिया।
 *
 * `migrate:create` generated the entire schema, because it diffs against the
 * previous *snapshot*, not against the live database — and this project had no
 * prior snapshot, so everything looked new. Applied to production (which was
 * restored from a dump and already has every table) that migration would have
 * failed on the first `CREATE TYPE`, and its `down()` would have dropped every
 * table in the database, poems included.
 *
 * इसलिए `up()` में सिर्फ़ वही है जो production में सचमुच नहीं है: यह एक table.
 * So `up()` contains only what production genuinely lacks: this one table. The
 * accompanying `.json` snapshot is kept as-is — it describes the full schema,
 * which is exactly what the database looks like once this has run, and it gives
 * the next `migrate:create` a correct baseline to diff against.
 *
 * ── दोबारा चलाने पर भी सुरक्षित / safe to run twice ──────────────────────────
 * `IF NOT EXISTS` और constraint के चारों ओर guard इसलिए हैं कि अधूरा चला हुआ
 * migration दोबारा चलाया जा सके — production पर एक बार चलने वाले काम के लिए यही
 * ठीक है। Idempotent so a half-applied run can simply be repeated, which matters
 * for a one-shot operation on a live server.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "identity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"byline" varchar DEFAULT 'आलोक कुमार सिंह' NOT NULL,
  	"role" varchar DEFAULT 'कवि',
  	"bio" varchar,
  	"signature" varchar DEFAULT 'आलोक',
  	"hero_image_id" integer,
  	"portrait_image_id" integer,
  	"portrait_caption" varchar DEFAULT 'अपनी गली में',
  	"portrait_datestamp" varchar DEFAULT '''२६ ०१ ०८',
  	"handle" varchar DEFAULT '@ambarkibaatein',
  	"copyright" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  DO $$ BEGIN
   ALTER TABLE "identity" ADD CONSTRAINT "identity_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
   ALTER TABLE "identity" ADD CONSTRAINT "identity_portrait_image_id_media_id_fk" FOREIGN KEY ("portrait_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "identity_hero_image_idx" ON "identity" USING btree ("hero_image_id");
  CREATE INDEX IF NOT EXISTS "identity_portrait_image_idx" ON "identity" USING btree ("portrait_image_id");`)
}

/**
 * सिर्फ़ यही table गिरती है / drops this table and nothing else.
 *
 * इसमें लेखक का परिचय होता है — नाम, बायो, दोनों तस्वीरों के links. रचनाएँ,
 * टिप्पणियाँ, तस्वीरें कहीं नहीं जातीं. This holds the author's identity only;
 * posts, comments and uploads are untouched. The pictures themselves live on
 * Cloudinary and survive regardless — this stores only which ones were chosen.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "identity" CASCADE;`)
}
