// P2 (audit 2026-11) — ŠIFRIRANJE SKRIVNOSTI V MIROVANJU.
//
// Vsak salon vpiše SVOJ Stripe secret key (platforma ga namerno ne hrani),
// vendar je bil v bazi shranjen v čistini (`Organization.stripeSecretKey`,
// `stripeWebhookSecret`). Kopija baze — backup, replika, `pg_dump` v rokah
// koga drugega — je tako pomenila možnost poljubnega obračuna na račun
// salona. Zdaj se ob zapisu šifrira z AES-256-GCM, ključ pa pride iz okolja
// (`SECRETS_ENCRYPTION_KEY`), ne iz baze.
//
// Prehodno stanje: vrstice, zapisane pred to spremembo, so v čistini.
// `decryptSecret` jih prepozna (brez `enc:v1:` predpone) in vrne kot so —
// zato migracija ni potrebna, vsak ponoven vpis pa vrstico nadgradi.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const PREFIX = "enc:v1:"
const ALGO = "aes-256-gcm"
const IV_BYTES = 12

let warnedMissingKey = false

/**
 * Ključ za šifriranje: `SECRETS_ENCRYPTION_KEY` (poljubna dolga skrivnost).
 * Iz nje naredimo 32-bajtni ključ s SHA-256, da dolžina ni omejena.
 */
function encryptionKey(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim()
  if (!raw) {
    if (!warnedMissingKey) {
      warnedMissingKey = true
      console.warn(
        "[secrets] SECRETS_ENCRYPTION_KEY ni nastavljen — skrivnosti se shranjujejo NEŠIFRIRANE. " +
          "Nastavite ga v produkciji (glej .env.example)."
      )
    }
    return null
  }
  return createHash("sha256").update(raw, "utf8").digest()
}

/** Ali je vrednost že šifrirana s tem modulom? */
export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX)
}

/**
 * Šifriraj skrivnost. Brez nastavljenega ključa vrne vrednost nespremenjeno
 * (aplikacija mora delovati tudi brez njega) — z opozorilom v dnevniku.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return plain
  if (isEncryptedSecret(plain)) return plain
  const key = encryptionKey()
  if (!key) return plain
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

/**
 * Dešifriraj skrivnost. Vrednost brez predpone (stara vrstica) vrne kot je.
 * Šifrirana vrednost brez ključa je NAPAKA — raje glasno odpovemo, kot da bi
 * šifrirano vrednost poslali Stripeu kot ključ.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (!isEncryptedSecret(stored)) return stored
  const key = encryptionKey()
  if (!key) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY manjka, v bazi pa je šifrirana skrivnost — dešifriranje ni mogoče."
    )
  }
  const body = stored.slice(PREFIX.length)
  const [ivB64, tagB64, ctB64] = body.split(":")
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Skrivnost v bazi je pokvarjena (napačen zapis).")
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/** Za teste/opozorila: ali je ključ v tem procesu nastavljen. */
export function isSecretsEncryptionEnabled(): boolean {
  return Boolean(process.env.SECRETS_ENCRYPTION_KEY?.trim())
}
