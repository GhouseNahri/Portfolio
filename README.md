# Ghouse Nahri — Portfolio

My personal developer portfolio: a single-page site introducing who I am,
what I'm learning, and what I've built — as an IT student and aspiring
software developer.

Built with [Astro](https://astro.build), [Tailwind CSS](https://tailwindcss.com),
and TypeScript. It ships almost zero client-side JavaScript: static HTML,
a tiny scroll-reveal powered by the native `IntersectionObserver`, and a
theme persisted in `localStorage` with system-preference detection.

## Features

- Dark / light theme with system detection and persistence
- Responsive from small phones (320px) to ultra-wide desktops
- Accessibility: skip link, visible focus states, reduced-motion support,
  44px minimum touch targets, labeled form fields
- SEO: Open Graph & Twitter cards, JSON-LD `Person` structured data,
  `robots.txt`, social preview image
- Honest content: sections render only what actually exists — no fake
  projects, stats, or testimonials

## Getting started

Requires Node.js >= 22.12.

```sh
npm install
npm run dev       # dev server at http://localhost:4321
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Project structure

```text
/
├── admin/             # local content admin (npm run admin)
├── public/            # static assets (favicons, og-image, robots.txt)
├── src/
│   ├── components/    # UI primitives + page sections
│   ├── data/site.ts   # ← all personal content lives here
│   ├── layouts/       # base HTML layout, meta & structured data
│   ├── pages/         # routes
│   ├── scripts/       # small client enhancements
│   └── styles/        # design tokens & global styles
└── astro.config.mjs
```

## Customizing content

Everything personal — name, tagline, skills, projects, education, links —
is data in `src/data/site.ts`. Update it and every section follows;
there is no content buried in component markup.

## Managing content — local admin app

A private, local-only admin app edits all portfolio content without
touching code:

```sh
npm run admin    # → http://localhost:4322 (Ctrl+C to stop)
```

- **Save draft** writes your edits to `src/data/site.ts` (uncommitted).
- **Publish** runs `git commit` + `git push` on your repo — Vercel picks
  it up and redeploys the live site in ~30 seconds.
- The admin runs only on your machine (bound to `127.0.0.1`); it is not
  part of the deployed site, needs no account, and exposes nothing
  publicly.

## Deployment

Static output — deployable to any static host (Vercel, Netlify,
Cloudflare Pages) with build command `npm run build` and output
directory `dist`.
