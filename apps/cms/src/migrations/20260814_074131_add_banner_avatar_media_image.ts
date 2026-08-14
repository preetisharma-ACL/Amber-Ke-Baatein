import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * तीन नए खाने, तीन नए स्तम्भ / three new upload fields, three new columns.
 *
 * ── क्या-क्या जुड़ा / what these are ─────────────────────────────────────────
 * `posts.bannerImage`    — शीर्षक के पीछे पूरी चौड़ाई वाली तस्वीर (collections/Posts.ts)
 * `gallery.mediaImage`   — "पहले से चढ़ी हुई तस्वीर" (collections/Gallery.ts)
 * `identity.avatarImage` — रचना के नीचे नाम के साथ गोल तस्वीर (globals/SiteIdentity.ts)
 *
 * तीनों `upload` खाने हैं और तीनों `media` की ओर इशारा करते हैं, इसलिए हर एक से
 * एक `integer` स्तम्भ, एक index और एक foreign key बनती है। All three are upload
 * fields pointing at `media`, so each yields one `integer` column, one index and
 * one foreign key — `ON DELETE set null`, Payload's own convention here, which is
 * what keeps deleting a picture from Media from taking the post with it.
 *
 * ── चौथा फ़र्क़: `gallery.alt` अब ज़रूरी नहीं / the fourth change ───────────────
 * `Gallery.alt` से `required: true` हटा है, इसलिए स्तम्भ का `NOT NULL` भी हटना
 * चाहिए। बिना इसके admin तो खाली `alt` मान लेता पर Postgres save ही न होने देता —
 * और ग़लती "फ़ॉर्म भरा है फिर भी सेव नहीं होता" जैसी दिखती, schema जैसी नहीं।
 *
 * Dropping `required: true` in the CMS is only half the change: the column's
 * NOT NULL has to go too, or Payload accepts a blank `alt` and Postgres refuses
 * the insert — which surfaces as "the form is filled in and still won't save",
 * not as a schema problem. See the `alt` note in collections/Gallery.ts for why
 * it stopped being required (the picked picture already carries one).
 *
 * ── `_posts_v` भी / the versions table too ──────────────────────────────────
 * `Posts` में `versions.drafts: true` है, इसलिए हर खाने की एक नक़ल `_posts_v` में
 * भी रहती है। उसे छोड़ देने पर banner वाली रचना का draft सेव नहीं होता।
 * Posts has `versions.drafts: true`, so every field has a mirror in `_posts_v`.
 * Leaving it out breaks saving a draft, not publishing — so it would have gone
 * unnoticed until an author tried to save one.
 *
 * ── जाँच कैसे हुई / how this was verified ────────────────────────────────────
 * `migrate:create` ने `20260811_112125_add_contact_global.json` से फ़र्क़ निकाला
 * (production वहीं तक पहुँचा हुआ है — 911f6a7)। दोनों snapshot हाथ से भी भिड़ाए
 * गए: कोई table न जुड़ा न हटा, कोई enum नहीं बदला, और चारों पुराने table में
 * ऊपर लिखे चार फ़र्क़ों के अलावा एक अक्षर नहीं बदला।
 *
 * Generated against the contact snapshot, which is exactly where production
 * stands (911f6a7). The two snapshots were also diffed by hand, section by
 * section: no table added or removed, no enum touched, and in `posts`,
 * `_posts_v`, `gallery` and `identity` nothing beyond the four changes above.
 *
 * ⚠️ snapshot की कड़ी नाम के क्रम से बनती है, `prevId` से नहीं — इस फ़ाइल और इसकी
 * `.json` दोनों को commit कीजिए, वरना अगली migration का आधार यह नहीं, contact
 * वाली होगी और यहाँ के चार फ़र्क़ दोबारा निकल आएँगे. Commit the `.json` alongside
 * this file: Payload picks the baseline by alphabetical order of the snapshots in
 * this folder, so a missing one silently makes the next diff wrong.
 *
 * ── दोबारा चलाने पर भी सुरक्षित / safe to run twice ──────────────────────────
 * वही रुख़ जो पिछली दोनों migration का है. The generator emits bare `ADD COLUMN`
 * and `CREATE INDEX`, which throw on a second run; guarded here so a run that
 * died halfway on a live server can just be repeated. `DROP NOT NULL` is already
 * a no-op the second time.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "gallery" ALTER COLUMN "alt" DROP NOT NULL;

  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "banner_image_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_banner_image_id" integer;
  ALTER TABLE "gallery" ADD COLUMN IF NOT EXISTS "media_image_id" integer;
  ALTER TABLE "identity" ADD COLUMN IF NOT EXISTS "avatar_image_id" integer;

  DO $$ BEGIN
   ALTER TABLE "posts" ADD CONSTRAINT "posts_banner_image_id_media_id_fk" FOREIGN KEY ("banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_banner_image_id_media_id_fk" FOREIGN KEY ("version_banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
   ALTER TABLE "gallery" ADD CONSTRAINT "gallery_media_image_id_media_id_fk" FOREIGN KEY ("media_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
   ALTER TABLE "identity" ADD CONSTRAINT "identity_avatar_image_id_media_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "posts_banner_image_idx" ON "posts" USING btree ("banner_image_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_version_version_banner_image_idx" ON "_posts_v" USING btree ("version_banner_image_id");
  CREATE INDEX IF NOT EXISTS "gallery_media_image_idx" ON "gallery" USING btree ("media_image_id");
  CREATE INDEX IF NOT EXISTS "identity_avatar_image_idx" ON "identity" USING btree ("avatar_image_id");`)
}

/**
 * सिर्फ़ ऊपर जोड़ी हुई चीज़ें हटती हैं / removes only what `up` added.
 *
 * चार स्तम्भ, चार index, चार foreign key — और `alt` का `NOT NULL` वापस। कोई
 * table नहीं गिरती। रचनाएँ, टिप्पणियाँ, तस्वीरें, उपयोक्ता, परिचय — किसी की
 * एक भी पंक्ति नहीं जाती, और पहले से मौजूद किसी स्तम्भ को छुआ नहीं जाता।
 *
 * Four columns, four indexes, four foreign keys, and `alt`'s NOT NULL back. No
 * table is dropped and no row is deleted anywhere. The only columns dropped are
 * the three this migration itself created (plus the `_posts_v` mirror), so no
 * pre-existing column in `posts`, `gallery`, `comments`, `media`, `users` or
 * `identity` is altered. What is genuinely lost is a banner / byline photo /
 * gallery pick an author had chosen — the *reference*, never the picture, which
 * stays in `media` and on Cloudinary.
 *
 * ⚠️ `alt` को सीधे `SET NOT NULL` करना नहीं चलता / a bare `SET NOT NULL` fails
 * here, and that is the whole point of this migration: after `up`, rows can be
 * saved with a blank `alt`. `SET NOT NULL` then aborts on the first such row and
 * takes the entire rollback down with it (Payload wraps a migration in one
 * transaction), leaving the operator with a failed `migrate:down` and no obvious
 * cause.
 *
 * इसलिए पहले caption से भर दिया जाता है — वही आख़िरी सहारा जो साइट ख़ुद लेती है
 * (`utils/gallery.ts`: `doc.alt || picked.alt || doc.caption`), और `caption`
 * ख़ुद `NOT NULL` है, इसलिए कोई पंक्ति ख़ाली नहीं बचती। So the nulls are filled
 * from `caption` first — the same last resort the site itself falls back to, and
 * `caption` is NOT NULL, so every row is guaranteed a value. This writes only
 * where there was nothing to lose: strictly `WHERE alt IS NULL`.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_banner_image_id_media_id_fk";
  ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_banner_image_id_media_id_fk";
  ALTER TABLE "gallery" DROP CONSTRAINT IF EXISTS "gallery_media_image_id_media_id_fk";
  ALTER TABLE "identity" DROP CONSTRAINT IF EXISTS "identity_avatar_image_id_media_id_fk";

  DROP INDEX IF EXISTS "posts_banner_image_idx";
  DROP INDEX IF EXISTS "_posts_v_version_version_banner_image_idx";
  DROP INDEX IF EXISTS "gallery_media_image_idx";
  DROP INDEX IF EXISTS "identity_avatar_image_idx";

  UPDATE "gallery" SET "alt" = "caption" WHERE "alt" IS NULL;
  ALTER TABLE "gallery" ALTER COLUMN "alt" SET NOT NULL;

  ALTER TABLE "posts" DROP COLUMN IF EXISTS "banner_image_id";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_banner_image_id";
  ALTER TABLE "gallery" DROP COLUMN IF EXISTS "media_image_id";
  ALTER TABLE "identity" DROP COLUMN IF EXISTS "avatar_image_id";`)
}
