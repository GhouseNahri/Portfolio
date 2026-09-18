// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Real production URL (deployed on Vercel, verified live). BaseLayout
  // emits <link rel="canonical">, og:url and the JSON-LD url from this.
  // If the site ever moves to a custom domain, change it here.
  site: 'https://portfolio-alpha-three-20.vercel.app',
  // Vercel adapter: public pages remain 100% pre-built static files;
  // the adapter additionally enables the server-rendered /admin page and
  // /api/* serverless routes used by the private admin (authentication +
  // publishing). Public page output and speed are unchanged.
  adapter: vercel({ webAnalytics: { enabled: false } }),
  vite: {
    plugins: [tailwindcss()]
  }
});