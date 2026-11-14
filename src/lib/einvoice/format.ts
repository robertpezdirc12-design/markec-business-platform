// F5.5.4.6.2 — čista pomožna funkcija za oznake formatov e-računov.
// V LASTNEM modulu, ker "use server" datoteke ne smejo izvažati sinhronih
// ne-async funkcij (Next.js: "Server Actions must be async functions").

/** Rabe glede na tip format: e-SLOG ali UBL/PEPPOL. */
export function formatLabel(f: string): string {
  return f === "ESLOG_2" ? "e-SLOG 2.0" : f === "UBL21_PEPPOL_3" ? "UBL 2.1 / BIS 3.0.x" : f
}