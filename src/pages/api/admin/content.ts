// GET /api/admin/content — the current portfolio content (session required).
// Serves the bundled site.ts state; after a publish the new content goes
// live when Vercel finishes its ~30-60s rebuild (new deployment = new
// bundle). The UI communicates that timing, it doesn't poll.
export const prerender = false;

import type { APIRoute } from "astro";
import { sessionFromRequest } from "../../../lib/auth";
import { currentSiteState } from "../../../lib/serverContent";

export const GET: APIRoute = async ({ request }) => {
  if (!sessionFromRequest(request)) {
    return new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(JSON.stringify({ state: currentSiteState() }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
