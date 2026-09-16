// ==========================================================================
// SITE DATA — the single source of truth for personal content.
// Sections import from here, so updating content never means touching
// component markup. Content was personalized in Phase 7 from the approved
// content specification. We never invent facts: empty sections stay empty
// until things are real.
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
  // Added after Phase 7: real profile URL, provided by Ghouse and shown
  // in the footer automatically. The auto-generated slug can be customized
  // later in LinkedIn settings without touching this file.
  linkedin: "https://www.linkedin.com/in/ghouse-undefined-441820437",
  // Privacy choice (Phase 1, re-confirmed Phase 7): email stays hidden;
  // visitors use the form or GitHub.
  email: "",
  // No resume yet — add a path/URL when it exists and the button wires up.
  resume: "",
} as const;

// Phase 7 (approved): origin = curiosity; this portfolio is the first
// real project; cyber security is named strictly as an interest, never
// as a skill.
export const about = {
  paragraphs: [
    "I'm Ghouse, an IT student at Matrusri Engineering College at the start of my developer journey. I got here through plain curiosity about how things work — and that curiosity shapes how I learn: fundamentals first. Python for everyday problem solving, C for understanding what's really happening inside data structures.",
    "I care about learning things properly rather than quickly: writing code that works, understanding why it works, and improving it. This portfolio is my first real project — built with an AI-assisted workflow that I drive: every design decision, every test, every commit is mine. My curiosity is now also pulling toward cyber security — learning how systems fail is the same question, asked from the other side.",
    "I'm looking for an internship where I can contribute, ask a lot of questions, and learn how real software teams work. Meanwhile, I keep sharpening the fundamentals and building things here, one honest project at a time.",
  ],
  // Currently learning — shown as chips in the About section. Python
  // graduated out in Phase 7: it's a listed skill now, not a learning
  // item. Security fundamentals joins as an approved, honest interest.
  currentlyLearning: ["Data structures", "Security fundamentals", "HTML & CSS"],
} as const;

// Phase 7 (approved): regrouped after building this portfolio — every
// item below has been genuinely used in this very project. The footnote
// is a self-assessment rendered under the grid; never percentages.
export const skills = {
  groups: [
    {
      label: "Languages",
      items: ["Python", "C", "TypeScript"],
    },
    {
      label: "Web & frameworks",
      items: ["HTML", "CSS", "Tailwind CSS", "Astro"],
    },
    {
      label: "Tools & workflow",
      items: ["Git & GitHub", "VS Code", "AI-assisted development"],
    },
  ],
  footnote:
    "Self-assessed: comfortable with Python · familiar with C · Astro, Tailwind and TypeScript new and growing.",
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
    {
      title: "Personal Portfolio Website",
      description:
        "The site you're looking at — built in phases like real software: design system first, sections one at a time, each tested and committed before moving on. An AI-assisted workflow that I drive: every decision and commit is mine.",
      tech: ["Astro", "TypeScript", "Tailwind CSS"],
      status: "in-progress",
      github: "https://github.com/GhouseNahri/portfolio",
      demo: "",
    },
  ],
} as const;

// Phase 7 (approved): real details replace the Phase 1 placeholder.
export const education = {
  entries: [
    {
      degree: "B.Tech in Information Technology",
      institution: "Matrusri Engineering College",
      period: "2025 — 2029",
      note: "", // optional: relevant coursework — intentionally empty
    },
  ],
} as const;
