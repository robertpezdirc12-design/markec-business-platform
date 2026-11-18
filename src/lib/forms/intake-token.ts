// ============================================================
// #96 v2 — ŽETON ZA POVEZAVO (SERVER LE)
//
// Ločeno od forms/intake.ts NAMERNA — FAZA 3 perf: forms/intake.ts
// je CLIENT-safe (intake-link-form.tsx v brskalniku klice
// validateIntakeAnswers). `import { randomBytes } from "crypto"` tu
// v forms/intake.ts je vlekel CELO Node polyfill nabor (buffer,
// crypto-browserify, stream-browserify, vm-browserify, events …)
// v JAVNI client bundle — 445 KB min / 133 KB gzip na vsaki javni
// strani (merjeno prek browser sourcemap, chunk 09vibc7k_e_p4).
// generateIntakeToken rabi le strežnik (actions + stripe webhook).
// ============================================================

import { randomBytes } from "crypto"

/**
 * Žeton za javno povezavo /intake/[token] — 48 znakov hex (192 bitov).
 * Povezava je pooblastilo sama po sebi (G2), zato je naključna, ne
 * izpeljana iz id ali časa.
 */
export function generateIntakeToken(): string {
  return randomBytes(24).toString("hex")
}
