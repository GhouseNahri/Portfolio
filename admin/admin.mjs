// ==========================================================================
// LOCAL PORTFOLIO ADMIN — a private, beginner-friendly content manager.
//
// What it is:
//   A tiny zero-dependency Node app that runs ONLY on this machine
//   (bound to 127.0.0.1) and edits `src/data/site.ts` — the single file
//   every portfolio section reads its content from.
//
// Workflow:
//   npm run admin   →  open http://localhost:4322
//   Edit fields  →  Save draft (writes site.ts, uncommitted)
//                →  Publish (git add site.ts → commit → push to main)
//                →  Vercel auto-redeploys the live site in ~30 seconds.
//
// Security model (agreed plan):
//   • Local-only: the server listens on the loopback interface — it is
//     not reachable from the network, is never deployed, and is not part
//     of the public site. There is nothing to authenticate into.
//   • Publishing runs `git` with your own local credentials — the app
//     never sees or stores them. GitHub auth = your existing setup.
//   • No secrets, tokens or passwords exist anywhere in this app.
//   • Publishing only ever commits `src/data/site.ts` — one file, so a
//     bad publish is exactly one `git revert` away (see Publish history
//     on the dashboard).
//
// Needs Node >= 22.12 (uses native TypeScript import to read site.ts,
// matching the engine requirement already declared in package.json).
// ==========================================================================

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(ROOT, "src", "data", "site.ts");
const DATA_URL = new URL(`file:///${DATA_FILE.split(path.sep).join("/")}`).href;
const PORT = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 4322;
const HOST = "127.0.0.1"; // loopback only — deliberately not 0.0.0.0

// --------------------------------------------------------------------------
// Data access — the live file is the single source of truth.
// --------------------------------------------------------------------------

async function readLive() {
  const mod = await import(`${DATA_URL}?t=${Date.now()}`); // cache-bust re-reads
  return {
    site: JSON.parse(JSON.stringify(mod.site)),
    about: JSON.parse(JSON.stringify(mod.about)),
    skills: JSON.parse(JSON.stringify(mod.skills)),
    projects: JSON.parse(JSON.stringify(mod.projects)),
    education: JSON.parse(JSON.stringify(mod.education)),
  };
}

async function readDraft() {
  try {
    const mod = await import(`${DATA_URL}?t=${Date.now()}`);
    const draft = {
      site: JSON.parse(JSON.stringify(mod.site)),
      about: JSON.parse(JSON.stringify(mod.about)),
      skills: JSON.parse(JSON.stringify(mod.skills)),
      projects: JSON.parse(JSON.stringify(mod.projects)),
      education: JSON.parse(JSON.stringify(mod.education)),
    };
    if (fs.existsSync(DRAFT_MARKER)) {
      draft._draft = JSON.parse(fs.readFileSync(DRAFT_MARKER, "utf8"));
    }
    return draft;
  } catch (err) {
    // A saved draft with a syntax error must NOT brick the admin — fall
    // back to the last committed version and tell the user.
    const fallback = await readCommitted();
    fallback._draftError = String(err.message || err).slice(0, 300);
    return fallback;
  }
}

async function readCommitted() {
  const text = execSync("git show HEAD:src/data/site.ts", {
    cwd: ROOT,
    encoding: "utf8",
  });
  // Must be a real .ts file (Node strips types only for .ts), placed in
  // the OS temp dir: Node refuses type-stripping under node_modules, and
  // the repo stays clean. Unique name sidesteps the ESM import cache.
  const tmp = path.join(os.tmpdir(), `.admin-committed-${process.pid}-${Date.now()}.ts`);
  fs.writeFileSync(tmp, text, "utf8");
  try {
    const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
    return {
      site: JSON.parse(JSON.stringify(mod.site)),
      about: JSON.parse(JSON.stringify(mod.about)),
      skills: JSON.parse(JSON.stringify(mod.skills)),
      projects: JSON.parse(JSON.stringify(mod.projects)),
      education: JSON.parse(JSON.stringify(mod.education)),
    };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const DRAFT_MARKER = path.join(ROOT, "admin", ".draft-meta.json");

function draftMeta() {
  try {
    return JSON.parse(fs.readFileSync(DRAFT_MARKER, "utf8"));
  } catch {
    return null;
  }
}

function writeDraft(state, note) {
  fs.writeFileSync(DATA_FILE, buildSiteTs(state), "utf8");
  fs.writeFileSync(DRAFT_MARKER, JSON.stringify({ savedAt: new Date().toISOString(), note: note || "" }), "utf8");
}

async function discardDraft() {
  const committed = await readCommitted();
  // Guard: the committed file may predate a schema field that the site now
  // requires (e.g. site.seo). Never discard our way into a broken build.
  if (!committed.site.seo) {
    committed.site.seo = {
      description:
        "IT student building solid foundations in Python, C and the web — learning by making real things. Open to internship opportunities.",
    };
  }
  fs.writeFileSync(
    DATA_FILE,
    buildSiteTs({
      site: committed.site,
      about: committed.about,
      skills: committed.skills,
      projects: committed.projects,
      education: committed.education,
    }),
    "utf8"
  );
  fs.rmSync(DRAFT_MARKER, { force: true });
}

// --------------------------------------------------------------------------
// site.ts generation — byte-faithful round-trip.
// The generator reproduces the hand-written file exactly (same comments,
// prettier's 80-column wrapping, trailing commas), so saving unchanged data
// produces an EMPTY diff, and a real edit shows only its own lines.
// --------------------------------------------------------------------------

// "key: value," — wraps the value to the next line (indent + 2) when the
// single-line form would exceed prettier's 80-column print width.
function kv(key, val, indent) {
  const pad = " ".repeat(indent);
  const one = `${pad}${key}: ${JSON.stringify(val ?? "")},`;
  if (one.length <= 80) return one;
  return `${pad}${key}:\n${pad}  ${JSON.stringify(val ?? "")},`;
}

// "key: ["a", "b"]," — inline when it fits, one-per-line when it doesn't.
function kvArr(key, items, indent) {
  const pad = " ".repeat(indent);
  const list = (items || []).map((it) => JSON.stringify(it ?? ""));
  const one = `${pad}${key}: [${list.join(", ")}],`;
  if (one.length <= 80 && !list.some((t) => t.includes("\n"))) return one;
  if (!list.length) return `${pad}${key}: [],`;
  return `${pad}${key}: [\n${list.map((t) => `${pad}  ${t},`).join("\n")}\n${pad}],`;
}

function buildSiteTs(state) {
  const s = state.site;
  const a = state.about;
  const sk = state.skills;
  const p = state.projects;
  const e = state.education;

  const projectEntries = (p.items || [])
    .map((pr) => {
      return `    {
${kv("title", pr.title, 6)}
${kv("description", pr.description, 6)}
${kvArr("tech", pr.tech || [], 6)}
${kv("status", pr.status, 6)}
${kv("github", pr.github, 6)}
${kv("demo", pr.demo, 6)}
    },`;
    })
    .join("\n");

  const educationEntries = (e.entries || [])
    .map((ed) => {
      return `    {
${kv("degree", ed.degree, 6)}
${kv("institution", ed.institution, 6)}
${kv("period", ed.period, 6)}
${kv("note", ed.note, 6)} // optional: relevant coursework — intentionally empty
    },`;
    })
    .join("\n");

  const skillGroups = (sk.groups || [])
    .map((g) => {
      return `    {
${kv("label", g.label, 6)}
${kvArr("items", g.items || [], 6)}
    },`;
    })
    .join("\n");

  return `// ==========================================================================
// SITE DATA — the single source of truth for personal content.
// Sections import from here, so updating content never means touching
// component markup. Content was personalized in Phase 7 from the approved
// content specification. We never invent facts: empty sections stay empty
// until things are real.
// ==========================================================================

export const site = {
${kv("name", s.name, 2)}
${kv("firstName", s.firstName, 2)}
${kv("role", s.role, 2)}
${kv("tagline", s.tagline, 2)}
  // Real (Phase 1): the portfolio exists to win internship opportunities.
${kv("availability", s.availability, 2)}
${kv("github", s.github, 2)}
  // Real profile URL (updated 2026-09-17 at Ghouse's request to the
  // full public-profile slug). Shown in the footer, contact section and
  // JSON-LD sameAs automatically.
${kv("linkedin", s.linkedin, 2)}
  // Privacy choice (Phase 1, re-confirmed Phase 7): email stays hidden;
  // visitors use the form or GitHub.
${kv("email", s.email, 2)}
  // No resume yet — add a path/URL when it exists and the button wires up.
${kv("resume", s.resume, 2)}
  // SEO (editable in the local admin): the homepage's default meta
  // description — also used for Open Graph / Twitter cards.
  seo: {
${kv("description", s.seo?.description, 4)}
  },
} as const;

// Phase 7 (approved): origin = curiosity; this portfolio is the first
// real project; cyber security is named strictly as an interest, never
// as a skill.
export const about = {
${kvArr("paragraphs", a.paragraphs || [], 2)}
  // Currently learning — shown as chips in the About section. Python
  // graduated out in Phase 7: it's a listed skill now, not a learning
  // item. Security fundamentals joins as an approved, honest interest.
${kvArr("currentlyLearning", a.currentlyLearning || [], 2)}
} as const;

// Phase 7 (approved): regrouped after building this portfolio — every
// item below has been genuinely used in this very project. The footnote
// is a self-assessment rendered under the grid; never percentages.
export const skills = {
  groups: [
${skillGroups}
  ],
${kv("footnote", sk.footnote, 2)}
} as const;

// Phase 7 (approved): the portfolio itself is the first listed project —
// real, in-progress until Phase 8 deployment, with the AI-assisted
// workflow stated openly. Add further projects newest-first:
//
// {
//   title: "Personal Portfolio Website",
//   description: "...",
//   tech: ["Astro", "TypeScript", "Tailwind CSS"],
//   status: "in-progress" | "live" | "archived",
//   github: "https://github.com/GhouseNahri/portfolio",
//   demo: "", // live URL if one exists
// },
export const projects = {
  items: [
${projectEntries}
  ],
} as const;

// Phase 7 (approved): real details replace the Phase 1 placeholder.
export const education = {
  entries: [
${educationEntries}
  ],
} as const;
`;
}

// --------------------------------------------------------------------------
// Validation — never silently accept malformed URLs (plan requirement).
// --------------------------------------------------------------------------

function validUrl(u) {
  if (!u) return true; // empty allowed — site renders honestly without
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validate(state) {
  const errors = [];
  const s = state.site || {};
  if (!String(s.name || "").trim()) errors.push("Name is required.");
  if (!validUrl(s.github)) errors.push("GitHub URL is not a valid http(s) URL.");
  if (!validUrl(s.linkedin)) errors.push("LinkedIn URL is not a valid http(s) URL.");
  if (!validUrl(s.resume)) errors.push("Resume URL is not a valid http(s) URL.");
  if (!validUrl(s.email)) errors.push("Email must be empty or a mailto: link.");
  for (const [i, pr] of (state.projects?.items || []).entries()) {
    if (!validUrl(pr.github)) errors.push(`Project ${i + 1} (“${pr.title}”): GitHub URL is not valid.`);
    if (!validUrl(pr.demo)) errors.push(`Project ${i + 1} (“${pr.title}”): demo URL is not valid.`);
  }
  return errors;
}

// --------------------------------------------------------------------------
// Publish — git commit + push of exactly one file, with a clean summary.
// --------------------------------------------------------------------------

function gitUser() {
  try {
    return execSync("git config user.name", { cwd: ROOT, encoding: "utf8" }).trim() || "you";
  } catch {
    return "you";
  }
}

function publish(message) {
  const summary = { pushed: false, error: null, ahead: 0 };
  try {
    const status = execSync("git status --porcelain src/data/site.ts", { cwd: ROOT, encoding: "utf8" }).trim();
    if (!status) return { ...summary, noop: true };

    execSync("git add src/data/site.ts", { cwd: ROOT });
    const msg = (message || "").trim() || "Update portfolio content via admin";
    execSync(["git", "commit", "-m", msg].map((a) => JSON.stringify(a)).join(" "), { cwd: ROOT, shell: true });
    execSync("git push", { cwd: ROOT });
    summary.pushed = true;
  } catch (err) {
    // Diagnose common, recoverable causes instead of a raw stack trace.
    const text = String(err.stderr || err.message || err);
    if (/push/i.test(text) && /fetch first|behind|rejected/i.test(text)) {
      summary.error =
        "Push rejected — your local branch is behind GitHub. In a terminal: git pull, resolve any conflict, then press Publish again.";
    } else if (/not a git repository/i.test(text)) {
      summary.error = "This folder is not a git repository — publish needs the portfolio repo.";
    } else if (/could not read from remote|Permission to .* denied/i.test(text)) {
      summary.error = "GitHub rejected the push (authentication). Check that you are signed in to GitHub on this machine.";
    } else {
      summary.error = text.trim().split("\n").slice(-3).join(" ").slice(0, 300);
    }
  }
  try {
    summary.ahead = Number(
      execSync("git rev-list --count origin/main..main", { cwd: ROOT, encoding: "utf8" }).trim()
    );
  } catch {
    /* remote not fetched — ignore */
  }
  return summary;
}

function publishHistory() {
  try {
    const out = execSync(
      'git log --max-count=12 --date=format:"%d %b %Y %H:%M" --pretty=format:"%h%x09%ad%x09%s" -- src/data/site.ts',
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [hash, date, ...rest] = line.split("\t");
      return { hash, date, message: rest.join("\t") };
    });
  } catch {
    return [];
  }
}

function getCommitMessage() {
  try {
    const diff = execSync("git diff -- src/data/site.ts", { cwd: ROOT, encoding: "utf8" }).trim();
    if (!diff) return "";
    const added = [];
    const removed = [];
    for (const line of diff.split("\n")) {
      const m = line.match(/^\+\s*(?:title|label):\s*"(.+)"/);
      if (m) added.push(m[1]);
      const m2 = line.match(/^-\s*(?:title|label):\s*"(.+)"/);
      if (m2) removed.push(m2[1]);
    }
    if (added.length || removed.length) {
      const parts = [];
      if (added.length) parts.push(`Add/update: ${added.slice(0, 4).join(", ")}`);
      if (removed.length) parts.push(`Remove: ${removed.slice(0, 4).join(", ")}`);
      return `Update portfolio content via admin — ${parts.join(" · ")}`;
    }
    return "Update portfolio content via admin";
  } catch {
    return "";
  }
}

// --------------------------------------------------------------------------
// HTTP plumbing
// --------------------------------------------------------------------------

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Body must be a JSON object");
  return parsed;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function serveStatic(res, relPath, status = 200) {
  const file = path.join(ROOT, "admin", relPath);
  if (!file.startsWith(path.join(ROOT, "admin"))) return sendJson(res, 403, { error: "forbidden" });
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: "not found" });
    res.writeHead(status, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

// --------------------------------------------------------------------------
// Server
// --------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    // ---- state ----
    if (url.pathname === "/api/state" && req.method === "GET") {
      const state = await readDraft();
      let git = { ahead: 0, dirty: false, user: gitUser(), branch: "main" };
      try {
        git.ahead = Number(execSync("git rev-list --count origin/main..main", { cwd: ROOT, encoding: "utf8" }).trim() || 0);
        git.dirty = !!execSync("git status --porcelain src/data/site.ts", { cwd: ROOT, encoding: "utf8" }).trim();
        git.branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
      } catch {
        /* git not ready — keep defaults */
      }
      return sendJson(res, 200, {
        state,
        meta: { draft: draftMeta(), git, history: publishHistory() },
      });
    }

    // ---- save draft ----
    if (url.pathname === "/api/save" && req.method === "POST") {
      const body = await readJsonBody(req);
      const errors = validate(body);
      if (errors.length) return sendJson(res, 400, { error: errors.join(" "), errors });
      writeDraft(body, body._note || "");
      const status = execSync("git status --porcelain src/data/site.ts", { cwd: ROOT, encoding: "utf8" }).trim();
      return sendJson(res, 200, { ok: true, changed: !!status });
    }

    // ---- commit message suggestion ----
    if (url.pathname === "/api/commit-message" && req.method === "GET") {
      return sendJson(res, 200, { message: getCommitMessage() });
    }

    // ---- publish ----
    if (url.pathname === "/api/publish" && req.method === "POST") {
      const body = await readJsonBody(req).catch(() => ({}));
      const result = publish(body.message);
      // Re-read state: after publish the draft == committed.
      return sendJson(res, result.error ? 500 : 200, result);
    }

    // ---- discard ----
    if (url.pathname === "/api/discard" && req.method === "POST") {
      await discardDraft();
      return sendJson(res, 200, { ok: true });
    }

    // ---- UI ----
    if (url.pathname === "/" || url.pathname === "/index.html") return serveStatic(res, "index.html");
    if (url.pathname === "/admin.js") return serveStatic(res, "admin.js");
    if (url.pathname === "/admin.css") return serveStatic(res, "admin.css");

    return sendJson(res, 404, { error: "not found" });
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err).slice(0, 400) });
  }
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────┐");
  console.log("  │  Portfolio Admin — private, runs on this PC only    │");
  console.log("  └─────────────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Open:  http://localhost:${PORT}`);
  console.log("  Stop:  Ctrl+C");
  console.log("");
  console.log("  Save draft  →  edits src/data/site.ts (not published)");
  console.log("  Publish     →  git commit + push → Vercel redeploys (~30s)");
  console.log("");
});
