# Ghouse Nahri — Personal Portfolio

Hi, I'm **Ghouse Nahri** — an IT student and aspiring software developer. I'm currently
learning and improving my programming skills, and this portfolio is how I do it:
by building real projects and understanding how software actually works, one honest
step at a time.

## 🌐 Live Website

**→ [https://portfolio-alpha-three-20.vercel.app](https://portfolio-alpha-three-20.vercel.app/)**

## 📌 About the Project

A personal developer portfolio built to present who I am and what I can do:

- **Hero** — name, role, availability badge, quick links
- **About** — my story, what I'm currently learning, and how I work
- **Skills** — grouped by Languages, Web & Frameworks, and Tools & Workflow
- **Projects** — starting with this portfolio itself, built in phased, tested increments
- **Education** — B.Tech in Information Technology at Matrusri Engineering College
- **Contact** — GitHub, LinkedIn, and a validated contact form

Everything on the site is real: no invented projects, no inflated skills, no fake
statistics. Content lives in one typed data file, so the site never claims anything
I can't back up.

## ✨ Features

- **Fully responsive design** — tested from 320px phones to ultra-wide desktops
- **Dark / light theme** — respects system preference, remembers your choice, no flash on load
- **Scroll-reveal animations** — GPU-composited, honors `prefers-reduced-motion`
- **Accessible by design** — semantic HTML, skip link, visible focus states, keyboard navigation, 44px touch targets, WCAG-checked contrast
- **SEO-ready** — semantic headings, meta description, canonical URL, Open Graph + Twitter cards, JSON-LD structured data (Person), robots.txt, social preview image
- **Zero-JS public pages** — the portfolio is pre-built static HTML; the only browser scripts are scroll-reveal and one tiny utility script (~1 KB)
- **Private content management** — content is edited and published through an authenticated dashboard, without touching code
- **One-click undo** — every publish is a git commit, so any past version of the content is one revert away

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Astro 7** (static output + serverless routes via the official Vercel adapter) |
| Styling | **Tailwind CSS 4** with a semantic design-token system |
| Language | **TypeScript** (strict mode) |
| Fonts | Space Grotesk, Inter, JetBrains Mono (self-hosted via Fontsource) |
| Admin auth | Node built-in `crypto` — scrypt hashing, HMAC-signed sessions (no auth dependency) |
| Deployment | **Vercel** (Git-based auto-deploy from `main`) |
| Version control | Git + GitHub |

## 📂 Project Structure

```
portfolio/
├── src/
│   ├── components/          # UI building blocks (Header, Footer, cards, buttons…)
│   │   └── sections/        # Page sections: Hero, About, Skills, Projects, Education, Contact
│   ├── data/
│   │   └── site.ts          # ← ALL content lives here (single source of truth)
│   ├── layouts/
│   │   └── BaseLayout.astro # Meta, fonts, theme init, structured data
│   ├── lib/                 # siteGenerator (byte-faithful site.ts writer), auth, serverContent
│   ├── pages/
│   │   ├── index.astro      # The public portfolio
│   │   ├── admin.astro      # Private admin (server-rendered, noindex, not linked anywhere)
│   │   └── api/admin/       # login · logout · session · content · publish · history · revert
│   ├── scripts/             # Browser scripts (scroll reveal, hidden admin trigger)
│   └── styles/              # Design tokens (global.css) + admin trigger styles
├── admin/                   # Local-only admin app (offline alternative to /admin)
├── scripts/
│   └── set-password.mjs     # Generates the scrypt hash for the admin password
└── public/                  # Favicons, social preview image, robots.txt
```

## 🚀 Getting Started

### Prerequisites

- **Node.js ≥ 22.12** (the site build and the local tools need it)
- npm (comes with Node)
- Git

### Installation

```bash
git clone https://github.com/GhouseNahri/portfolio.git
cd portfolio
npm install
```

### Development

```bash
npm run dev
```

Starts the dev server at `http://localhost:4321`.

### Build

```bash
npm run build
```

Outputs the production build to `dist/`.

### Preview

```bash
npm run preview
```

Serves the production build locally for a final check.

## 🌍 Deployment

The site is deployed on **Vercel** and connected to this repository: every push to
`main` triggers an automatic build and goes live in about a minute. No manual deploy
steps are needed.

## 📈 Current Learning & Future Improvements

- Deepening fundamentals: Python, C, data structures, and security fundamentals
- Adding more real projects as they're built (newest first)
- Wiring the contact form to an email service so messages actually arrive
- A custom domain once I pick one
