// ============================================================
// FOTOGRAFIJE NAROČILA — čista pravila (brez DB)
//
// Pravila so ločena od strežniških akcij, da jih je mogoče testirati in
// da jih UI in strežnik uporabljata enako (dvakrat napisano pravilo je
// vedno pravilo, ki se prej ali slej raziđe).
// ============================================================

/** Največ fotografij na posamezno naročilo. */
export const MAX_PHOTOS_PER_ORDER = 40

/** Največja dolžina opisa fotografije. */
export const MAX_PHOTO_CAPTION = 120

/**
 * Ali je URL varen za prikaz v `<img src>`?
 *
 * Dovoljene so le absolutne https slike (Cloudinary, naš /api/media) in
 * naše lastne poti. `javascript:` in `data:` sta izključena — fotografija
 * je uporabniški vnos in ne sme postati izvršljiva vsebina.
 */
export function isAllowedPhotoUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith("javascript:") || url.startsWith("data:")) return false
  if (url.startsWith("/")) return url.length > 1
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

/** Očisti opis: poravna presledke, odreže odvečno in omeji dolžino. */
export function sanitizeCaption(input: string | null | undefined): string | null {
  const value = (input ?? "").replace(/\s+/g, " ").trim()
  if (!value) return null
  return value.slice(0, MAX_PHOTO_CAPTION)
}

export interface PhotoGuardResult {
  ok: boolean
  error?: "LIMIT_REACHED" | "INVALID_URL"
}

/** Preveri, ali je fotografijo mogoče dodati. */
export function canAddPhoto(params: {
  currentCount: number
  url: string
}): PhotoGuardResult {
  if (!isAllowedPhotoUrl(params.url)) return { ok: false, error: "INVALID_URL" }
  if (params.currentCount >= MAX_PHOTOS_PER_ORDER) {
    return { ok: false, error: "LIMIT_REACHED" }
  }
  return { ok: true }
}

/** Fotografije, združene po stopnji (vrstni red stopenj ohrani klicatelj). */
export function groupPhotosByStage<T extends { stageKey: string | null }>(
  photos: T[]
): { stageKey: string | null; photos: T[] }[] {
  const groups = new Map<string | null, T[]>()
  for (const photo of photos) {
    const key = photo.stageKey
    const bucket = groups.get(key)
    if (bucket) bucket.push(photo)
    else groups.set(key, [photo])
  }
  return Array.from(groups, ([stageKey, items]) => ({ stageKey, photos: items }))
}
