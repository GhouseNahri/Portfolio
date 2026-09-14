// ==========================================================================
// SITE DATA — the single source of truth for personal content.
// Sections import from here, so updating content never means touching
// component markup. Anything marked PLACEHOLDER waits on real info
// (Phase 7 — Content & Personalization). We never invent facts.
// ==========================================================================

export const site = {
  name: "Ghouse Nahri",
  firstName: "Ghouse",
  role: "IT Student & Aspiring Software Developer",
  tagline:
    "Exploring the software world — building solid foundations in Python and C, and learning by making real things.",
  // Real (Phase 1): the portfolio exists to win internship opportunities.
  availability: "Open to internship opportunities",
  github: "https://github.com/GhouseNahri",
  // PLACEHOLDER: add your LinkedIn URL here when ready — links wire up automatically.
  linkedin: "",
  // Privacy choice (Phase 1): email stays hidden; visitors use the form or GitHub.
  email: "",
  // PLACEHOLDER: no resume yet — add a path/URL when it exists.
  resume: "",
} as const;

export const about = {
  // Drafted from your Phase 1 answers — review & personalize in Phase 7.
  paragraphs: [
    "I'm Ghouse, an IT student at the start of my developer journey. Right now I'm strengthening my fundamentals — Python for everyday problem solving, and C for understanding what's really happening inside data structures.",
    "I care about learning things properly rather than quickly: writing code that works, understanding why it works, and improving it. This portfolio is part of that — every project here is real, built by me, and documented honestly, including what I found difficult.",
    "I'm looking for an internship where I can contribute, ask a lot of questions, and learn how real software teams work.",
  ],
  // What I'm currently learning — shown as chips in the About section.
  currentlyLearning: ["Python", "C — data structures", "HTML & CSS"],
} as const;

export const skills = {
  // Real skills only (Phase 1). No proficiency bars, no invented tools.
  groups: [
    {
      label: "Languages",
      items: ["Python", "C"],
    },
    {
      label: "Web basics",
      items: ["HTML", "CSS"],
    },
    {
      label: "Currently learning",
      items: ["Data structures", "Git & GitHub"],
    },
  ],
} as const;

export const projects = {
  // REAL PROJECTS GO HERE as they're built — newest first:
  //
  // {
  //   title: "Project name",
  //   description: "One or two sentences: what it does and why it exists.",
  //   tech: ["Python"],
  //   status: "in-progress" | "live" | "archived",
  //   github: "https://github.com/GhouseNahri/...",
  //   demo: "", // live URL if one exists
  // },
  //
  // Empty for now is honest — the first project is being planned together.
  items: [],
} as const;

export const education = {
  // PLACEHOLDER (Phase 1): details pending — fill in when ready.
  entries: [
    {
      degree: "IT degree", // PLACEHOLDER — e.g. "B.Tech in Information Technology"
      institution: "Institution name", // PLACEHOLDER
      period: "20XX — 20XX", // PLACEHOLDER — expected graduation
      note: "", // optional: relevant coursework
    },
  ],
} as const;
