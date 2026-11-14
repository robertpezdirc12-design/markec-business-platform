// F2.2.1 — čisto jedro za povabilne žetone.
//
// `src/app/actions/workspace-management.ts` je `"use server"` modul: vsak
// izvoz MORA biti async server action (Next bundler pravilo — sinhrona
// funkcija tam sicer povzroči "Server Actions must be async functions" in
// 500 na straneh, ki modul uvozijo). Hash je čista sinhrona pomožnica,
// zato živi tu; tudi strežniški UI (invite stran) in testi jo uvozijo
// neposredno s te poti.
import { createHash } from "node:crypto"

/**
 * SHA-256 hash surovega povabilnega žetona (hex). Baza hrani SAMO hash;
 * surovi žeton odide klicatelju natanko enkrat in se nikoli ne zapiše,
 * ne v bazo ne v loge (F2.2.1).
 */
export function hashInvitationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
