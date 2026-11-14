// ============================================================
// F5.5.4.6.4 — Varnostni sloj za poverilnice e-računov (AES-256-GCM).
//
// Poverilnice ponudnikov so v DB SHITRIANE (AES-256-GCM) in NIKOLI v čisti obliki.
// Vsak kanal ima svojo vrstico `EInvoiceChannelConfig` (org-scoped). Kriptografski
// ključ prihaja iz aplikacijskega okolja (`EINVOICE_SECRET_KEY`); če ni nastavljen,
// se v development izpelje deterministično iz AUTH_SECRET (za reprodukcijo), v
// produkciji PAS BREZ KEY pa funpcije vržejo — NO fallback na plosko shranjevanje.
//
// Format na disku (base64): iv|tag|ciphertext
// ============================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const KEY_CACHE: Buffer | null = null

function appKey(): Buffer {
  if (KEY_CACHE) return KEY_CACHE
  const env = process.env.EINVOICE_SECRET_KEY
  if (env && env.length >= 32) {
    return createHash("sha256").update(env).digest()
  }
  // Dev fallback iz AUTH_SECRET — deterministično, reproducibilno; ni varno v prod DLJIVO.
  const auth = process.env.AUTH_SECRET
  if (auth) return createHash("sha256").update("einvoice:" + auth).digest()
  throw new Error("EINVOICE_SECRET_KEY ni nastavljen — ni mogoče šifrirati/odšifrirati poverilnic.")
}

/** Šifrira čisti string → base64 `iv|tag|cipher`. Vrže, če ni ključa. */
export function encryptSecret(plain: string): string {
  if (!plain) return ""
  const key = appKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join("|")
}

/** Odšifrira prej zapisano vrednost. Vrne null ob napačnem podatku (brez izmeta tajnosti). */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    const [ivB64, tagB64, dataB64] = payload.split("|")
    if (!ivB64 || !tagB64 || !dataB64) return null
    const key = appKey()
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null // ne razkrij detajlov napake
  }
}

/** Pomožni: redakcija poverilnice za prikaz (nikoli polna). */
export function redact(secret: string): string {
  if (!secret) return ""
  return secret.length <= 4 ? "••••" : "•".repeat(Math.min(8, secret.length)) + secret.slice(-2)
}