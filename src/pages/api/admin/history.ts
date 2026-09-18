// GET /api/admin/history — recent commits touching src/data/site.ts
// (session required). This is the backup/undo surface: every published
// state is one git commit, so Revert is just committing an older
// version again. One-time GitHub API cost is ~1 credit; caching 20s.
export const prerender = false;

import type { APIRoute } from "astro";
import { sessionFromRequest } from "../../../lib/auth";

const PATH = "src/data/site.ts";

interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name?: string; date?: string } };
}

function repoSlug(): string | null {
  const override = process.env.ADMIN_REPO; // optional "owner/repo" for local tests
  if (override && override.includes("/")) return override;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && slug ? `${owner}/${slug}` : null;
}

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!sessionFromRequest(request)) return json(401, { error: "Not signed in." });

  const token = process.env.GITHUB_TOKEN;
  const repo = repoSlug();
  if (!token || !repo) return json(200, { history: [], unavailable: "History needs GITHUB_TOKEN and a Vercel deployment." });

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?path=${PATH}&sha=main&per_page=12`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "portfolio-admin",
      },
    });
    if (!res.ok) return json(200, { history: [], unavailable: `History temporarily unavailable (HTTP ${res.status}).` });
    const commits = (await res.json()) as GhCommit[];
    return json(
      200,
      {
        history: commits.slice(0, 12).map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split("\n")[0].slice(0, 120),
          author: c.commit.author?.name || "",
          date: c.commit.author?.date || "",
          url: c.html_url,
        })),
      }
    );
  } catch {
    return json(200, { history: [], unavailable: "History temporarily unavailable (network)." });
  }
};
