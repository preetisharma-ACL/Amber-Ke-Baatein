// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // साइट का पता — og:url और canonical इसी से बनते हैं। पता बदले तो यहाँ बदलिए।
  // पुरानी फ़ाइल में यही पता हर पन्ने पर एक जैसा लगा था; अब हर पन्ने को अपना
  // पूरा पता मिलता है।
  //
  // Base URL for og:url and <link rel="canonical">. Without it a production
  // build would bake the build server's origin (localhost) into every page.
  // The old single-file build hardcoded this same domain for every page —
  // now each page gets its own full URL.
  site: 'https://ambarkibaatein.com',

  vite: {
    // monorepo में .env जड़ (root) पर है, इस app के अंदर नहीं।
    // The .env lives at the monorepo root, not inside this app, so both
    // apps/web and apps/cms read one file. Vite resolves envDir relative to
    // the Astro project root (apps/web), so '../../' points at the repo root.
    envDir: '../../',

    ssr: {
      // @amber/shared TypeScript source भेजता है — Vite इसे bundle करे, externalize न करे।
      // The shared package has no build step, so Vite must compile it rather
      // than externalizing it the way it does for normal node_modules deps.
      noExternal: ['@amber/shared'],
    },
  },
});
