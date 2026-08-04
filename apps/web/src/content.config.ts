import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// `z` from 'astro:content' is deprecated in Astro 7 — 'astro/zod' is the
// supported import now.
import { z } from 'astro/zod';

/**
 * रचनाओं का संग्रह / the posts collection.
 *
 * Astro 5+ expects this file at `src/content.config.ts` (the older
 * `src/content/config.ts` location now errors), and every collection
 * must declare a `loader`.
 *
 * `date` जान-बूझकर string है — "1 अगस्त 2026" जैसी हिन्दी तारीख़ को
 * JS Date पार्स नहीं कर सकता, इसलिए जैसा लिखा है वैसा ही दिखता है।
 * `date` is deliberately a plain string: Hindi date strings like
 * "1 अगस्त 2026" are not JS-Date-parseable, so they are displayed as-is.
 * Ordering uses `order` instead (see src/utils/posts.ts).
 */
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z.object({
    /** जैसा दिखाना है वैसा ही, e.g. "1 अगस्त 2026" */
    date: z.string(),
    /** श्रेणी, e.g. "संस्मरण", "कविता", "मार्गदर्शन" */
    category: z.string(),
    title: z.string(),
    excerpt: z.string(),
    /**
     * क्रम — बड़ा नंबर पहले दिखता है (नई रचना = बड़ा नंबर).
     * Sort key: higher shows first. Optional; defaults to 0.
     */
    order: z.number().default(0),
    /** true = सूची में न दिखे / hide from listings */
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
