// POST /api/admin/login — server-side credential verification.
// The browser only ever learns "yes" or "no"; password, hash and any
// secret stay on the server. Failures are generic (never reveal whether
// the ID or the password was wrong) and repeated failures are throttled.
export const prerender = false;

import type { APIRoute } from "astro";
import {
  checkCredentials,
  newSessionToken,
  recordFailure,
  throttleStatus,
  clearFailures,
} from "../../../lib/auth";

const GENERIC_ERROR = "Invalid ID or password.";

export const POST: APIRoute = async ({ request, cookies }) => {
  const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

  // Already signed in? Nothing to do but confirm (idempotent).
  // Throttle first: repeated failed attempts cost a cooldown, even if the
  // credentials in later tries would be correct.
  const throttle = throttleStatus(request);
  if (throttle.blocked) {
    return new Response(
      JSON.stringify({
        error: `Too many failed attempts. Try again in about ${Math.ceil(throttle.retryAfterSec / 60)} minute(s).`,
      }),
      { status: 429, headers: { ...jsonHeaders, "Retry-After": String(throttle.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 400, headers: jsonHeaders });
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 400, headers: jsonHeaders });
  }

  const username = typeof (body as { username?: unknown })?.username === "string" ? (body as { username: string }).username.slice(0, 200) : "";
  const password = typeof (body as { password?: unknown })?.password === "string" ? (body as { password: string }).password.slice(0, 1024) : "";

  if (!username || !password || !checkCredentials(username, password)) {
    const failure = recordFailure(request);
    const headers: Record<string, string> = { ...jsonHeaders };
    if (failure.blockedNow) {
      headers["Retry-After"] = String(failure.retryAfterSec);
      return new Response(
        JSON.stringify({
          error: `Too many failed attempts. Try again in about ${Math.ceil(failure.retryAfterSec / 60)} minute(s).`,
        }),
        { status: 429, headers }
      );
    }
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 401, headers });
  }

  // Success: clear the failure counter, start the signed session.
  clearFailures(request);
  const { token, maxAge } = newSessionToken(username);
  cookies.set("pf_admin", token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge,
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
};
