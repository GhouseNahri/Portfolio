// ==========================================================================
// SITE GENERATOR — the single writer of src/data/site.ts.
// Ported 1:1 from the proven local admin app (admin/admin.mjs): the
// output is byte-identical to the hand-written file (same comments,
// prettier's 80-column wrapping, trailing commas). Consequences:
//   • Publishing unchanged content produces an EMPTY diff.
//   • A real edit shows only its own lines in git — reviewable history.
// ==========================================================================

export interface ProjectItem {
  title: string;
  description: string;
  tech: string[];
  status: string;
  github: string;
  demo: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  note: string;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface SiteState {
  site: {
    name: string;
    firstName: string;
    role: string;
    tagline: string;
    availability: string;
    github: string;
    linkedin: string;
    email: string;
    resume: string;
    seo: { description: string };
  };
  about: { paragraphs: string[]; currentlyLearning: string[] };
  skills: { groups: SkillGroup[]; footnote: string };
  projects: { items: ProjectItem[] };
  education: { entries: EducationEntry[] };
}

// "key: value," — wraps the value to the next line (indent + 2) when the
// single-line form would exceed prettier's 80-column print width.
function kv(key: string, val: string, indent: number): string {
  const pad = " ".repeat(indent);
  const one = `${pad}${key}: ${JSON.stringify(val ?? "")},`;
  if (one.length <= 80) return one;
  return `${pad}${key}:\n${pad}  ${JSON.stringify(val ?? "")},`;
}

// "key: ["a", "b"]," — inline when it fits, one-per-line when it doesn't.
function kvArr(key: string, items: string[], indent: number): string {
  const pad = " ".repeat(indent);
  const list = (items || []).map((it) => JSON.stringify(it ?? ""));
  const one = `${pad}${key}: [${list.join(", ")}],`;
  if (one.length <= 80 && !list.some((t) => t.includes("\n"))) return one;
  if (!list.length) return `${pad}${key}: [],`;
  return `${pad}${key}: [\n${list.map((t) => `${pad}  ${t},`).join("\n")}\n${pad}],`;
}

export function buildSiteTs(state: SiteState): string {
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
// Runs SERVER-SIDE on every publish: the client is never trusted.
// --------------------------------------------------------------------------

function validUrl(u: unknown): boolean {
  if (!u) return true; // empty allowed — site renders honestly without
  if (typeof u !== "string") return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const MAX_TEXT = 2000;
const MAX_LIST = 50;

function text(v: unknown, max = MAX_TEXT): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function strList(v: unknown, max = MAX_LIST): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 200)).slice(0, max);
}

/** Normalize arbitrary client JSON into a complete, size-capped SiteState. */
export function normalizeState(input: Partial<SiteState>): SiteState {
  const s = input.site || ({} as SiteState["site"]);
  const seo = (s as { seo?: { description?: string } }).seo || {};
  const site: SiteState["site"] = {
    name: text(s.name, 120),
    firstName: text(s.firstName, 60),
    role: text(s.role, 160),
    tagline: text(s.tagline, 300),
    availability: text(s.availability, 120),
    github: text(s.github, 300).trim(),
    linkedin: text(s.linkedin, 300).trim(),
    email: text(s.email, 200).trim(),
    resume: text(s.resume, 300).trim(),
    seo: { description: text(seo.description, 400) },
  };
  const about: SiteState["about"] = {
    paragraphs: strList(input.about?.paragraphs, 12).map((p) => p.slice(0, MAX_TEXT)),
    currentlyLearning: strList(input.about?.currentlyLearning, 16),
  };
  const skills: SiteState["skills"] = {
    groups: (Array.isArray(input.skills?.groups) ? input.skills!.groups : [])
      .slice(0, 12)
      .map((g) => ({
        label: text((g as SkillGroup)?.label, 60),
        items: strList((g as SkillGroup)?.items, 30),
      })),
    footnote: text(input.skills?.footnote, 400),
  };
  const projects: SiteState["projects"] = {
    items: (Array.isArray(input.projects?.items) ? input.projects!.items : [])
      .slice(0, 24)
      .map((pr) => {
        const item = pr as Partial<ProjectItem>;
        return {
          title: text(item.title, 120),
          description: text(item.description, MAX_TEXT),
          tech: strList(item.tech, 20),
          status: ["in-progress", "live", "archived"].includes(String(item.status))
            ? String(item.status)
            : "in-progress",
          github: text(item.github, 300).trim(),
          demo: text(item.demo, 300).trim(),
        };
      }),
  };
  const education: SiteState["education"] = {
    entries: (Array.isArray(input.education?.entries) ? input.education!.entries : [])
      .slice(0, 12)
      .map((ed) => {
        const item = ed as Partial<EducationEntry>;
        return {
          degree: text(item.degree, 160),
          institution: text(item.institution, 160),
          period: text(item.period, 60),
          note: text(item.note, MAX_TEXT),
        };
      }),
  };
  return { site, about, skills, projects, education };
}

export function validate(state: SiteState): string[] {
  const errors: string[] = [];
  const s = state.site;
  if (!s.name.trim()) errors.push("Name is required.");
  if (!validUrl(s.github)) errors.push("GitHub URL is not a valid http(s) URL.");
  if (!validUrl(s.linkedin)) errors.push("LinkedIn URL is not a valid http(s) URL.");
  if (!validUrl(s.resume)) errors.push("Resume URL is not a valid http(s) URL.");
  if (s.email && !/^mailto:[^\s]+@[^\s]+$/.test(s.email))
    errors.push("Email must be empty or a mailto: link like mailto:you@example.com.");
  state.projects.items.forEach((pr, i) => {
    if (!validUrl(pr.github))
      errors.push(`Project ${i + 1} (“${pr.title || "untitled"}”): GitHub URL is not valid.`);
    if (!validUrl(pr.demo))
      errors.push(`Project ${i + 1} (“${pr.title || "untitled"}”): demo URL is not valid.`);
  });
  return errors;
}
