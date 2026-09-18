// POST /api/admin/publish — commit the edited src/data/site.ts to main
// through the GitHub API. Vercel's Git integration rebuilds and deploys
// automatically (~30-60s). Session required; content validated SERVER-SIDE
// (the client is never trusted); the token lives only in Vercel env vars.
export const prerender = false;

import type { APIRoute } from "astro";
import { sessionFromRequest } from "../../../lib/auth";
import { buildSiteTs, normalizeState, validate, type SiteState } from "../../../lib/siteGenerator";
import { currentSiteState } from "../../../lib/serverContent";

const PATH = "src/data/site.ts";

function repoSlug(): string | null {
  const override = process.env.ADMIN_REPO; // optional "owner/repo" for local tests
  if (override && override.includes("/")) return override;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  return owner && slug ? `${owner}/${slug}` : null;
}

function json(status: number, data: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function ghFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portfolio-admin",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function friendlyGhError(res: Response): Promise<string> {
  if (res.status === 401) return "GitHub rejected the token (401). Create a fresh fine-grained PAT with Contents Read/Write on this repo and update GITHUB_TOKEN.";
  if (res.status === 403)
    return "GitHub denied the action (403). The token needs Contents: Read and write permission on GhouseNahri/portfolio — check the PAT's repository access too.";
  if (res.status === 409)
    return "The file changed on GitHub while you were editing (409). Reload the dashboard and re-apply your edit, then publish again.";
  if (res.status === 404) return "Repository or file not found (404). Check the token's repository access.";
  try {
    const data = (await res.json()) as { message?: string };
    if (data?.message) return `GitHub API error: ${data.message}`.slice(0, 300);
  } catch {
    /* ignore parse failure */
  }
  return `GitHub API error (HTTP ${res.status}).`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!sessionFromRequest(request)) return json(401, { error: "Not signed in." });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return json(500, { error: "Server not configured: GITHUB_TOKEN is missing." });

  const repo = repoSlug();
  if (!repo) return json(500, { error: "Server not configured: repository not identified (deploy on Vercel or set ADMIN_REPO)." });

  // ---- parse + validate the incoming state (server-side, always) ----
  let body: { state?: unknown; message?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 256_000) return json(400, { error: "Content too large." });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid request body." });
  }
  const state: SiteState = normalizeState((body.state || {}) as Partial<SiteState>);
  const errors = validate(state);
  if (errors.length) return json(400, { error: errors.join(" "), errors });

  const fileContent = buildSiteTs(state);

  // No-op guard: identical content → say so instead of an empty commit.
  const current = currentSiteState();
  if (buildSiteTs(current) === fileContent) {
    return json(200, { noop: true, message: "Content is unchanged — nothing to publish." });
  }

  const userMessage = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  const commitMessage = userMessage || "Update portfolio content via admin";

  try {
    // 1) Current file sha (needed to update it; also detects drift).
    const getRes = await ghFetch(`https://api.github.com/repos/${repo}/contents/${PATH}?ref=main`, token);
    if (!getRes.ok) return json(502, { error: await friendlyGhError(getRes) });
    const currentFile = (await getRes.json()) as { sha?: string };
    if (!currentFile.sha) return json(502, { error: "GitHub response missing file sha." });

    // 2) Commit the new content to main.
    const putRes = await ghFetch(`https://api.github.com/repos/${repo}/contents/${PATH}`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(fileContent, "utf8").toString("base64"),
        branch: "main",
        sha: currentFile.sha,
      }),
    });
    if (!putRes.ok) return json(502, { error: await friendlyGhError(putRes) });
    const result = (await putRes.json()) as { commit?: { sha?: string; html_url?: string } };

    return json(200, {
      ok: true,
      commit: { sha: result.commit?.sha, url: result.commit?.html_url },
      deployHint: "Published. Vercel is rebuilding — your site will show the change in about 30-60 seconds.",
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === "TimeoutError" ? "GitHub did not respond in time — try again." : "Publishing failed unexpectedly. Try again; if it persists, check the token and repository settings.";
    return json(502, { error: msg });
  }
};
