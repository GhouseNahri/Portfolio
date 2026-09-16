// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // DEPLOYMENT DAY (Phase 8 audit #3): set the real public URL here, e.g.
  //   site: 'https://ghousenahri.github.io',
  // BaseLayout then emits <link rel="canonical"> + og:url automatically.
  // Never invented before the domain exists.
  vite: {
    plugins: [tailwindcss()]
  }
});