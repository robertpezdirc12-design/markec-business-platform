/**
 * P1 (audit 2026-11) — VARNI TIPI NALOŽENIH SLIK.
 *
 * Ranljivost: `/api/upload` je sprejel VSE `image/*` — torej tudi
 * `image/svg+xml`. SVG lahko vsebuje `<script>`, `/api/media/[id]` pa ga je
 * vrnil z istim MIME tipom z izvora aplikacije → shranjeni XSS. Avatar lahko
 * naloži tudi navadna stranka (CLIENTE), zato je bila pot do XSS odprta vsem
 * prijavljenim uporabnikom. `nosniff` ne pomaga, ker je tip "pravi", CSP pa
 * je v načinu Report-Only.
 *
 * Pravilo: dovolimo SAMO rastrske formate, ki jih brskalnik ne more izvesti,
 * in preverimo MAGIC BYTES (Content-Type iz obrazca je zgolj trditev
 * odjemalca). Whitelist je enak kot pri R2 poti.
 */

/** Rastrski formati, ki jih sprejmemo (in jih brskalnik ne izvaja). */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

/**
 * Prebere dejanski tip iz prvih bajtov datoteke.
 * `null` = ne prepoznamo (ali ni na whitelistu) → zavrni.
 */
export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  // GIF: "GIF87a" | "GIF89a"
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to))
  const head6 = ascii(0, 6)
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif"
  // WebP: "RIFF" .... "WEBP"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  // AVIF: ISO-BMFF — "ftyp" na 4..8, blagovna znamka "avif"/"avis" na 8..12
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12)
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
  return null
}

export type ImageValidationResult =
  | { ok: true; mime: AllowedImageMime; bytes: Uint8Array }
  | { ok: false; error: "unsupported_type" | "content_mismatch" }

/**
 * Preveri deklarirani tip IN vsebino.
 *
 * @param declaredMime `file.type` iz obrazca (nezaupanja vreden)
 * @param buffer       cela datoteka (potrebujemo jo tako ali tako za shranjevanje)
 */
export function validateImageUpload(
  declaredMime: string,
  buffer: Uint8Array
): ImageValidationResult {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    return { ok: false, error: "unsupported_type" }
  }
  const detected = detectImageMime(buffer)
  if (!detected) return { ok: false, error: "content_mismatch" }
  // Deklarirani in dejanski tip se morata ujemati (jpeg/png zamenjava bi
  // sicer razkrila napako v nadaljnji obdelavi).
  if (detected !== declaredMime) return { ok: false, error: "content_mismatch" }
  return { ok: true, mime: detected, bytes: buffer }
}
