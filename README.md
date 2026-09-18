# Personal Portfolio — Ghouse Nahri

Live: **https://portfolio-alpha-three-20.vercel.app** · Repo: `GhouseNahri/portfolio`

A fast, accessible, fully static portfolio for an IT student — plus a private,
authenticated admin system for editing content without touching code.

## Tech stack

- **Astro 7** — 100% static public pages, zero client JS beyond scroll-reveal + the tiny hidden admin trigger
- **Tailwind CSS 4** with a semantic design-token system (`src/styles/global.css`)
- **@astrojs/vercel** adapter — public pages remain static files; `/admin` + `/api/admin/*` run as secure serverless functions
- Content lives in **one file**: `src/data/site.ts`. Components are pure presentation.

## Private admin system

The public site has **no admin link** — by design. Access:

1. Go to the live site → find the **dot of the final “i” in “Nahri”** (hero headline)
2. **Click it 5 times within 3 seconds** → the login page opens at `/admin`
3. Enter your Admin ID + password (verified server-side; signed session cookie, 2 h)

The trigger is a doorbell, not a lock — discovering it gains nothing without credentials.

### Editing content (beginner workflow)

1. Open `/admin` (see above) → dashboard
2. Edit fields — every field is plain language; SEO description has a live Google-result preview
3. **Publish changes** → committed to `main` via GitHub API → Vercel redeploys → **live in ~30–60s**
4. Made a mistake? **Publish → Content history → Revert** (one click restores any past version)

Deletions ask for confirmation; every published state is a git commit — the full backup
is your repository history.

### Environment variables (names only — set in the Vercel dashboard)

| Name | Purpose |
|---|---|
| `ADMIN_USERNAME` | your Admin ID |
| `ADMIN_PASSWORD_HASH` | output of `npm run admin:set-password` (scrypt hash — never the plain password) |
| `SESSION_SECRET` | random 32-byte key signing session cookies — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `GITHUB_TOKEN` | fine-grained PAT, repository access: `GhouseNahri/portfolio` only, permission: **Contents → Read and write** |

Set them under Vercel → your project → Settings → Environment Variables, then **Deployments → ⋯ → Redeploy**.

### Recovery paths (you can never be locked out)

- **Forgot the password?** Run `npm run admin:set-password`, paste the new hash into `ADMIN_PASSWORD_HASH`, redeploy.
- **Token expired/revoked?** Create a new PAT, replace `GITHUB_TOKEN`, redeploy.
- **Bad content published?** Dashboard → Publish → history → **Revert**, or a normal `git revert` from a terminal.

### Two admins — same file, same format

| | **Online dashboard** (`/admin`) | **Local admin** (`npm run admin`, port 4322) |
|---|---|---|
| Where it runs | Anywhere (browser), behind authentication | This PC only (127.0.0.1) |
| Auth | Server-side ID + password + session cookie | Loopback-only, no auth (by design) |
| Publish | GitHub API → auto-redeploy | git commit + push |
| Preview | Publish and watch the live site (30–60s) | Save draft → `npm run dev`… blocked on this PC by Smart App Control |
| Best for | Editing from anywhere | Offline, no-token editing + direct file access |

Both write `src/data/site.ts` with the same shared generator (`src/lib/siteGenerator.ts`),
so the file format stays byte-identical whichever tool you use.

### Site maintenance notes

- SEO config lives in `astro.config.mjs` (`site:`) — canonical, og:url and JSON-LD derive from it.
- The project card status values are `in-progress | live | archived`; first project = featured.
- Deploy preview command: `npm run preview` after `npm run build` (desktop only — this PC's
  Smart App Control currently blocks Astro binaries; **Vercel builds fine on Linux** — the
  adapter + build is verified in the Vercel build log on every push).

## Project structure

```
src/
├── components/           # Pure presentation, one section per file
│   ├── sections/         # Hero, About, Skills, Projects, Education, Contact
│   ├── Header.astro      # Sticky nav + theme toggle
│   └── Footer.astro      # Socials + copyright
├── data/site.ts          # ← ALL content lives here (the admin edits this)
├── layouts/BaseLayout.astro  # Meta, fonts, theme, structured data
├── lib/                  # siteGenerator (byte-faithful site.ts writer),
│                         # auth (scrypt + sessions), serverContent
├── pages/
│   ├── index.astro       # The public portfolio
│   ├── admin.astro       # Private admin (server-rendered, noindex)
│   └── api/admin/*.ts    # login · logout · session · content · publish · history · revert
├── scripts/              # Browser scripts (reveal, adminTrigger)
└── styles/               # global.css tokens + adminTrigger.css
```

## Security model

- The 5-click trigger is obscurity only — **authentication is real and server-side**
- Password stored as an scrypt hash in Vercel env vars (never in Git, never client-side)
- Session = HMAC-signed, HttpOnly + Secure + SameSite=Strict cookie, 2-hour expiry
- Generic login errors; per-IP failure throttling with cooldown
- Publish/revert/history APIs all verify the session on every request
- Secrets never in source, never in the browser, never in Git
