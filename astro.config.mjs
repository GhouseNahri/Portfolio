// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Real production URL (deployed on Vercel, verified live). BaseLayout
  // emits <link rel="canonical">, og:url and the JSON-LD url from this.
  // If the site ever moves to a custom domain, change it here.
  site: 'https://portfolio-alpha-three-20.vercel.app',
  vite: {
    plugins: [tailwindcss()]
  }
});