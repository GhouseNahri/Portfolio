// POST /api/admin/revert — restore src/data/site.ts to a previous
// version by re-committing that commit's file content (session required).
// Safer than git revert here: no merge machinery, produces a clean
// "Revert to ..." commit even when later commits touched other files.
// The old file content comes from the GitHub API using the SAME token
// the publish route uses — no extra permission, no raw sha args in URLs.
export const prerender = false;

import type { APIRoute } from "astro";
import { sessionFromRequest } from "../../../lib/auth";
import { normalizeState, buildSiteTs, validate, type SiteState } from "../../../lib/siteGenerator";

const PATH = "src/data/site.ts";
const SHA_RE = /^[0-9a-f]{7,40}$/;

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
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!sessionFromRequest(request)) return json(401, { error: "Not signed in." });

  const token = process.env.GITHUB_TOKEN;
  const repo = repoSlug();
  if (!token) return json(500, { error: "Server not configured: GITHUB_TOKEN is missing." });
  if (!repo) return json(500, { error: "Server not configured: repository not identified." });

  // ---- input validation: sha shape only, never composed into URLs raw ----
  let sha = "";
  try {
    const body = (await request.json()) as { sha?: unknown };
    sha = typeof body.sha === "string" ? body.sha.trim().toLowerCase() : "";
  } catch {
    return json(400, { error: "Invalid request body." });
  }
  if (!SHA_RE.test(sha)) return json(400, { error: "Invalid commit reference." });

  try {
    // 1) Fetch that commit's site.ts (proves the ref exists + is a blob).
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${PATH}?ref=${sha}`, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "portfolio-admin",
      },
    });
    if (!getRes.ok) {
      return json(502, {
        error:
          getRes.status === 422
            ? "That commit does not contain a recoverable version of the content file."
            : `Could not read the old version (HTTP ${getRes.status}).`,
      });
    }
    const file = (await getRes.json()) as { sha?: string; content?: string };
    if (!file.sha || typeof file.content !== "string") {
      return json(502, { error: "Could not read the old version of the content file." });
    }
    const restoredText = Buffer.from(file.content, "base64").toString("utf8");

    // 2) Safety round-trip: parse + normalize + regenerate + validate.
    //    A revert can never publish a syntactically broken data file.
    const tmpPath = `data:text/javascript;base64,${Buffer.from(restoredText).toString("base64")}`;
    let parsedState: SiteState;
    try {
      const mod = await import(/* @vite-ignore */ tmpPath);
      parsedState = normalizeState({
        site: mod.site,
        about: mod.about,
        skills: mod.skills,
        projects: mod.projects,
        education: mod.education,
      });
    } catch {
      return json(502, { error: "The old version could not be parsed — it may predate the current data format. Re-apply the content manually instead." });
    }
    const regenerated = buildSiteTs(parsedState);
    const errors = validate(parsedState);
    if (errors.length) return json(502, { error: `Old version fails validation: ${errors.join(" ")}` });

    // 3) Commit it (current sha read fresh, like publish).
    const headRes = await fetch(`https://api.github.com/repos/${repo}/contents/${PATH}?ref=main`, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "portfolio-admin",
      },
    });
    if (!headRes.ok) return json(502, { error: `Could not read the current file (HTTP ${headRes.status}).` });
    const head = (await headRes.json()) as { sha?: string };
    if (!head.sha) return json(502, { error: "GitHub response missing file sha." });

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${PATH}`, {
      method: "PUT",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "portfolio-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Revert portfolio content to ${sha.slice(0, 7)} via admin`,
        content: Buffer.from(regenerated, "utf8").toString("base64"),
        branch: "main",
        sha: head.sha,
      }),
    });
    if (!putRes.ok) {
      return json(502, { error: `GitHub rejected the revert commit (HTTP ${putRes.status}).` });
    }

    return json(200, {
      ok: true,
      deployHint: "Revert published. Vercel is rebuilding — your site will show the restored content in about 30-60 seconds.",
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === "TimeoutError" ? "GitHub did not respond in time — try again." : "Revert failed unexpectedly. Try again.";
    return json(502, { error: msg });
  }
};
