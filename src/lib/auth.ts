// ==========================================================================
// AUTH — server-side authentication for the private admin system.
// Runs ONLY inside serverless routes (/api/admin/*) on Vercel: the
// browser never sees any of this code or these secrets.
//
// Primitives used (all Node built-ins — zero new dependencies):
//   • crypto.scryptSync — password hashing (memory-hard; brute-force is
//     expensive by design). Parameters are stored inside the hash string
//     so they can be upgraded later without breaking old hashes.
//   • crypto.createHmac — session tokens are signed; a tampered cookie
//     fails verification. Timing-safe comparison everywhere.
//   • HttpOnly + Secure + SameSite=Strict cookies — JavaScript on the
//     page cannot read the session; it only travels over HTTPS; other
//     sites cannot cause the browser to send it (CSRF defence).
//
// Environment variables required (names only — set in the Vercel
// dashboard; values NEVER go in Git):
//   ADMIN_USERNAME      your login name (plain — not secret-sensitive)
//   ADMIN_PASSWORD_HASH output of `npm run admin:set-password`
//   SESSION_SECRET      random 32+ byte key used to sign session tokens
//   GITHUB_TOKEN        fine-grained PAT, Contents: Read/Write on this
//                       repo only — used by the publish route
// ==========================================================================

import { createHmac, randomBytes, timingSafeEqual, scryptSync } from "node:crypto";

// ----------------------------------------------------------- credentials

/** Hash parameter bundle (kept short — the name matches the K-format). */
export function K(logN: number, r: number, p: number): { logN: number; r: number; p: number } {
  return { logN, r, p };
}

export function adminUsername(): string {
  return process.env.ADMIN_USERNAME || "";
}

/** Parse "s1$logN$r$p$salt$key" as produced by scripts/set-password.mjs. */
export function parseHash(encoded: string): { logN: number; r: number; p: number; salt: Buffer; key: Buffer } | null {
  try {
    const parts = encoded.trim().split("$");
    if (parts.length !== 6 || parts[0] !== "s1") return null;
    const logN = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(logN) || logN < 10 || logN > 22) return null;
    if (!Number.isInteger(r) || r < 8 || r > 64) return null;
    if (!Number.isInteger(p) || p < 1 || p > 8) return null;
    const salt = Buffer.from(parts[4], "base64url");
    const key = Buffer.from(parts[5], "base64url");
    if (salt.length < 8 || key.length < 32) return null;
    return { logN, r, p, salt, key };
  } catch {
    return null;
  }
}

/** Constant-time string comparison (length leak is non-sensitive here). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a compare to keep timing flat for equal-length inputs.
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function verifyPassword(password: string): boolean {
  const encoded = process.env.ADMIN_PASSWORD_HASH || "";
  const parsed = parseHash(encoded);
  if (!parsed) return false; // misconfigured — never accept
  const params = { logN: parsed.logN, r: parsed.r, p: parsed.p };
  // maxmem must cover scrypt's working memory: 128·N·r bytes (×2 headroom).
  // A too-small cap throws RangeError instead of hashing.
  const derived = scryptSync(password.normalize("NFKC"), parsed.salt, parsed.key.length, {
    N: 2 ** params.logN,
    r: params.r,
    p: params.p,
    maxmem: 128 * 2 ** params.logN * params.r * 2,
  });
  if (derived.length !== parsed.key.length) return false;
  return timingSafeEqual(derived, parsed.key);
}

/** One generic failure — never reveal whether the ID or password was wrong. */
export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = adminUsername();
  if (!expectedUser || !process.env.ADMIN_PASSWORD_HASH) return false;
  const userOk = safeEqual(username, expectedUser);
  const passOk = verifyPassword(password);
  return userOk && passOk;
}

// ---------------------------------------------------------------- sessions

const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
export const SESSION_COOKIE = "pf_admin";

function secret(): string {
  return process.env.SESSION_SECRET || "";
}

/** opaque token: base64url(payload).base64url(HMAC(payload)) */
export function signSession(data: { u: string; exp: number }): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): { u: string } | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.u !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 < Date.now()) return null; // expired
    return { u: data.u };
  } catch {
    return null;
  }
}

export function sessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}

export function newSessionToken(username: string): { token: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return { token: signSession({ u: username, exp }), maxAge: SESSION_TTL_SECONDS };
}

/** RFC 6265 cookie header — HttpOnly, Secure, SameSite=Strict, Path=/. */
export function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Read the session from an incoming request; null when not signed in. */
export function sessionFromRequest(req: Request): { u: string } | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? verifySession(decodeURIComponent(m[1])) : null;
}

// -------------------------------------------------------- login throttle
// In-memory per-IP counter with cooldown. Honest limits (documented in
// the plan): serverless instances are ephemeral, so this is best-effort
// friction, not a hard guarantee. Real brute-force resistance comes from
// scrypt cost + a long password + the hidden trigger gate.

type Attempt = { count: number; firstAt: number; blockedUntil: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000; // sliding 10-minute window
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 5 * 60 * 1000; // locked for 5 minutes after the 5th

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || "unknown").trim();
}

export function throttleStatus(req: Request): { blocked: boolean; retryAfterSec: number } {
  const a = attempts.get(clientKey(req));
  if (!a) return { blocked: false, retryAfterSec: 0 };
  if (a.blockedUntil > Date.now()) {
    return { blocked: true, retryAfterSec: Math.ceil((a.blockedUntil - Date.now()) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export function recordFailure(req: Request): { blockedNow: boolean; retryAfterSec: number } {
  const key = clientKey(req);
  const now = Date.now();
  const a = attempts.get(key) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (now - a.firstAt > WINDOW_MS) {
    a.count = 0;
    a.firstAt = now;
  }
  a.count += 1;
  let blockedNow = false;
  let retryAfterSec = 0;
  if (a.count >= MAX_ATTEMPTS) {
    a.blockedUntil = now + COOLDOWN_MS;
    blockedNow = true;
    retryAfterSec = Math.ceil(COOLDOWN_MS / 1000);
  }
  attempts.set(key, a);
  return { blockedNow, retryAfterSec };
}

export function clearFailures(req: Request): void {
  attempts.delete(clientKey(req));
}

/** Best-effort map trim (serverless instances live short anyway). */
if (attempts.size > 5000) attempts.clear();

// --------------------------------------------------------------- secrets

export function requireEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v : null;
}

/** Fresh secret suggestion for the README/setup flow. */
export function suggestSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}
