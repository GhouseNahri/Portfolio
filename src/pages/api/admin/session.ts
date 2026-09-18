// GET /api/admin/session — lets the admin UI check whether a valid,
// unexpired session exists (the cookie itself is HttpOnly, so JS cannot
// inspect it directly; it asks the server instead).
export const prerender = false;

import type { APIRoute } from "astro";
import { sessionFromRequest } from "../../../lib/auth";

export const GET: APIRoute = async ({ request }) => {
  const session = sessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(JSON.stringify({ authenticated: true, username: session.u }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
