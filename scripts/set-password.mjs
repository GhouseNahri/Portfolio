// ==========================================================================
// ADMIN PASSWORD SETUP — one-time helper for the online admin system.
//
//   npm run admin:set-password
//
// What it does:
//   1. Asks you to type a password (hidden input — nothing on screen).
//   2. Prints an scrypt hash string (K format) to paste into the Vercel
//      dashboard as the ADMIN_PASSWORD_HASH environment variable.
//
// Security properties:
//   • The PLAIN password is never written to any file, shown on screen,
//     or transmitted anywhere. It exists only in memory, then vanishes.
//   • The printed hash is a ONE-WAY scramble: it can verify a password
//     but cannot be reversed into it. Safe to store in Vercel's
//     encrypted environment variables (never in Git).
//   • N=2^15, r=8, p=1 — recommended LogN 15, same parameters used by
//     the login route, so hashes remain verifiable.
//   • A fresh 16-byte random salt is generated every run: hashing the
//     same password twice yields different hashes (normal + safe).
//
// Recovery path (documented in README):
//   Forgot the password? Run this script again and replace the
//   ADMIN_PASSWORD_HASH value in Vercel. You can never be locked out.
// ==========================================================================

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes, scryptSync } from "node:crypto";
import { K } from "../src/lib/auth.ts";

console.log("");
console.log("Portfolio admin — password setup");
console.log("--------------------------------");
console.log("Type a password (input hidden), then press Enter.");
console.log("Use something long and unique — length beats complexity.");
console.log("");

const rl = readline.createInterface({ input: stdin, output: stdout });
const password = await rl.question("Password: ", {
  terminal: true, // hides typed characters where supported
});
rl.close();

if (typeof password !== "string" || password.length < 12) {
  console.error("\n✗ Password must be at least 12 characters. Run again.");
  process.exit(1);
}

const K_PARAM = K(15, 8, 1); // must match the login route
const salt = randomBytes(16);
// maxmem: 128·N·r bytes working memory, ×2 headroom.
const key = scryptSync(password.normalize("NFKC"), salt, 64, {
  N: 2 ** K_PARAM.logN,
  r: K_PARAM.r,
  p: K_PARAM.p,
  maxmem: 128 * 2 ** K_PARAM.logN * K_PARAM.r * 2,
});

const encoded = [
  "s1",
  K_PARAM.logN,
  K_PARAM.r,
  K_PARAM.p,
  salt.toString("base64url"),
  key.toString("base64url"),
].join("$");

console.log("");
console.log("✓ Hash generated. In the Vercel dashboard → your project →");
console.log("  Settings → Environment Variables, set:");
console.log("");
console.log("  Name:   ADMIN_PASSWORD_HASH");
console.log("  Value:  (paste the line below)");
console.log("");
console.log(encoded);
console.log("");
console.log("Also set: ADMIN_USERNAME (your login name),");
console.log("          SESSION_SECRET (see README for a one-liner),");
console.log("          GITHUB_TOKEN  (fine-grained PAT for GhouseNahri/portfolio).");
console.log("Then redeploy (Deployments → ⋯ → Redeploy) so they take effect.");
