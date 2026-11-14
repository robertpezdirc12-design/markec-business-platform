// ============================================================
// F5.1 — PROMOTION ENGINE (ČIST, STREŽNIŠKI VIRO RESNICE)
//
// VSE cene in popusti se izračunajo TUKAJ ali v strežniških akcijah,
// ki ta modul kličejo. Brskalnik nikoli ne pošlje cene ali popusta —
// pošlje le izbiro (kateri izdelki/storitve, morebitno promo kodo).
// Ta modul je namenoma čist (brez Prisma/React), da deluje enako v
// product checkoutu, v rezervaciji storitev in v enotnih testih.
//
// KLJUČNA PRAVILA (§4 zahteve F5.1):
//   • Avtoritativni izračun na strežniku.
//   • Decimalna natančnost z round2 (centi, brez float šuma).
//   • Končna cena nikoli negativna: popust ≤ osnova.
//   • Prekrivanje popustov: NAJVEČ ENA promocija na transakcijo.
//     Če stranka vnese kodo → ta promocija (če velja) zmaga. Sicer
//     se med vsemi aktivnimi avtomatskimi promocijami izbere NAJVEČJI
//     popust (deterministično, preverljivo).
//   • Preveri rok veljavnosti, omejitve uporabe in minimalno vrednost.
//   • Posnetek uporabljene promocije se shrani na naročilo/rezervacijo
//     (immutabilnost zgodovine).
// ============================================================

/** Posamezna vrstica transakcije, ki jo promocija lahko delno pokrije. */
export interface PricingLine {
  kind: "product" | "service"
  // Identitete za ujemanje obsega (scope).
  productId?: string
  serviceId?: string
  categoryId?: string
  /** Znesek vrstice (cena × količina za izdelek; cena za storitev). */
  amount: number
  quantity: number
}

/** Čisti opis promocijskega pravila — to, kar akcija prebere iz Prisme. */
export interface PromotionRule {
  id: string
  organizationId: string
  name: string
  discountType: "PERCENT" | "FIXED"
  /** PERCENT: 0–100. FIXED: EUR znesek. */
  discountValue: number
  scope: "WHOLE_AMOUNT" | "PRODUCTS" | "SERVICES" | "CATEGORIES"
  targetEntityIds: string[]
  code?: string | null
  startsAt?: Date | null
  endsAt?: Date | null
  maxRedemptions?: number | null
  maxPerCustomer?: number | null
  minOrderValue?: number | null
  status: "DRAFT" | "ACTIVE" | "INACTIVE"
}

/** Posnetek, ki gre na Order/Appointment (statičen, JSON). */
export interface PromotionSnapshot {
  promotionId: string
  name: string
  discountType: "PERCENT" | "FIXED"
  discountValue: number
  scope: PromotionRule["scope"]
  targetEntityIds: string[]
  code?: string | null
  /** Znesek, na katerega se je popust nanašal. */
  baseAmount: number
  /** Dejansko odšteti znesek (v EUR). */
  discountAmount: number
  /** Število vrstic, na katere se je popust nanašal. */
  affectedLines: number
  appliedAt: string // ISO
}

/** Centna natančnost (enako kot deposit.ts). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const isActiveStatus = (r: PromotionRule) => r.status === "ACTIVE"

/** Ali je promocija v svojem časovnem oknu (startsAt/endsAt vključno). */
export function isWithinWindow(
  rule: PromotionRule,
  now: Date = new Date()
): boolean {
  if (rule.startsAt && rule.startsAt.getTime() > now.getTime()) return false
  if (rule.endsAt && rule.endsAt.getTime() < now.getTime()) return false
  return true
}

/** Vrstice, na katere se ta promocija (glede na scope) nanaša. */
export function affectedLines(rule: PromotionRule, lines: PricingLine[]): PricingLine[] {
  switch (rule.scope) {
    case "WHOLE_AMOUNT":
      return lines
    case "PRODUCTS": {
      const ids = new Set(rule.targetEntityIds)
      return lines.filter(
        (l) => l.kind === "product" && (ids.size === 0 || (l.productId && ids.has(l.productId)))
      )
    }
    case "SERVICES": {
      const ids = new Set(rule.targetEntityIds)
      return lines.filter(
        (l) => l.kind === "service" && (ids.size === 0 || (l.serviceId && ids.has(l.serviceId)))
      )
    }
    case "CATEGORIES": {
      const ids = new Set(rule.targetEntityIds)
      return lines.filter((l) => l.categoryId && ids.has(l.categoryId))
    }
  }
}

/** Neto vsota veljavnih vrstic (odštete za izdelke × količina). */
export function lineAmount(lines: PricingLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0)
}

/** Omejitvena vsota transakcije (subtotal) za minOrderValue. */
export function transactionAmount(lines: PricingLine[]): number {
  // Enako kot subtotal v checkoutu: vsota vseh vrstic.
  return round2(lines.reduce((sum, l) => sum + l.amount, 0))
}

/**
 * Pogoji upravičenosti, ki NE zahtevajo omejitev uporabe
 * (doseg, časovno okno, minimalna vrednost, obstoj pokritih vrstic).
 * Omejitve uporabe (maxRedemptions / maxPerCustomer) se preverjajo
 * ATOMSKO ob unovčenju (akcija / engine), ne v tem čistem testu.
 */
export function isEligible(
  rule: PromotionRule,
  lines: PricingLine[],
  now: Date = new Date()
): boolean {
  if (!isActiveStatus(rule)) return false
  if (!isWithinWindow(rule, now)) return false

  const affected = affectedLines(rule, lines)
  if (affected.length === 0) return false

  // Minimalna vrednost naročila (pred popustom).
  if (
    rule.minOrderValue != null &&
    rule.minOrderValue > 0 &&
    transactionAmount(lines) < rule.minOrderValue
  ) {
    return false
  }

  // Vrednost popusta mora biti pozitivna.
  return computeDiscountAmount(rule, affected) > 0
}

/** Izračuna odšteti znesek na dani osnovi (same rules; line-item aware). */
export function computeDiscountAmount(rule: PromotionRule, affected: PricingLine[]): number {
  const base = lineAmount(affected)
  if (base <= 0) return 0
  if (rule.discountType === "FIXED") {
    // Fiksni popust: omejen na osnovo, da cena ni nikoli negativna.
    return round2(Math.min(rule.discountValue, base))
  }
  // PERCENT — normaliziramo na največ 100 %.
  const pct = Math.max(0, Math.min(rule.discountValue, 100))
  return round2((base * pct) / 100)
}

/** Celoten rezultat ene promocije (osnova + odštet znesek + meta). */
export function evaluatePromotion(
  rule: PromotionRule,
  lines: PricingLine[]
): { baseAmount: number; discountAmount: number; affectedLines: number } | null {
  const affected = affectedLines(rule, lines)
  if (affected.length === 0) return null
  const baseAmount = lineAmount(affected)
  if (baseAmount <= 0) return null
  const discountAmount = computeDiscountAmount(rule, affected)
  if (discountAmount <= 0) return null
  return { baseAmount, discountAmount, affectedLines: affected.length }
}

/**
 * Izbere PROMOCIJO za transakcijo po jasnem pravilu (največ ena):
 *   1. če je podan `code`, mora ta koda ustrezati aktivni promociji z
 *      enim od pravil; vrne se ta (če je upravičen).
 *   2. sicer se med aktivnimi avtomatskimi (brez kode) izbere NAJVEČJI
 *      popust.
 * Vrne null, če nič ne velja.
 */
export function bestPromotion(
  rules: PromotionRule[],
  lines: PricingLine[],
  opts: { code?: string | null; now?: Date } = {}
): { rule: PromotionRule; baseAmount: number; discountAmount: number; affectedLines: number } | null {
  const now = opts.now ?? new Date()

  // 1) Koda: natanko ena promocija z natančnim ujemanjem.
  if (opts.code && opts.code.trim()) {
    const code = opts.code.trim().toUpperCase()
    const match = rules.find(
      (r) => r.code && r.code.toUpperCase() === code && isEligible(r, lines, now)
    )
    if (match) {
      const res = evaluatePromotion(match, lines)
      if (res) return { rule: match, ...res }
    }
    // Tuj ali neveljaven code → preprosto ne velja (akcija pošlje napako).
    return null
  }

  // 2) Brez kode: največji popust med avtomatskimi promocijami.
  let best: { rule: PromotionRule; baseAmount: number; discountAmount: number; affectedLines: number } | null = null
  for (const r of rules) {
    if (r.code) continue // koda zahteva vnos
    if (!isEligible(r, lines, now)) continue
    const res = evaluatePromotion(r, lines)
    if (!res) continue
    if (!best || res.discountAmount > best.discountAmount) {
      best = { rule: r, ...res }
    }
  }
  return best
}

/**
 * F5.1 — MULTI KODA (več promocij na enem naročilu, Shopify vzorec).
 *
 * Vrne ARRAY popustov — ena za vsako podano kodo, ki je veljavna in
 * upravičena. Skupni odbitek je varovano omejen, da nikoli ne preseže
 * osnove postavk (brez negativnih cen, brez "dvojnega" popusta nad 100 %).
 *
 * Kode se nanašajo vsaka na svojo osnovo po obsegu (scope); seštevek se
 * združi na koncu. Samodejne (brez-kodne) promocije se pri več kodah ne
 * dodajajo — več kod je EKSPLICITNA izbira stranke.
 */
export function bestPromotions(
  rules: PromotionRule[],
  lines: PricingLine[],
  opts: { codes?: string[] | null; now?: Date } = {}
): { rule: PromotionRule; baseAmount: number; discountAmount: number; affectedLines: number }[] {
  const now = opts.now ?? new Date()
  const codes = (opts.codes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean)

  if (codes.length === 0) {
    return []
  }

  const out: { rule: PromotionRule; baseAmount: number; discountAmount: number; affectedLines: number }[] = []
  const byCode = new Map<string, PromotionRule>()
  for (const r of rules) {
    if (!r.code) continue
    byCode.set(r.code.toUpperCase(), r)
  }

  const usedIds = new Set<string>()
  for (const code of codes) {
    const rule = byCode.get(code)
    if (!rule || usedIds.has(rule.id)) continue
    usedIds.add(rule.id)
    if (!isEligible(rule, lines, now)) continue
    const res = evaluatePromotion(rule, lines)
    if (res) out.push({ rule, ...res })
  }

  // Skupni popust nikoli ne preseže celotne osnove transakcije (varnost).
  const baseTotal = transactionAmount(lines)
  const sum = out.reduce((s, o) => s + o.discountAmount, 0)
  if (sum > baseTotal && baseTotal > 0) {
    // Sorazmerno znižamo zadnji popust do meje (nikoli ne odbije več kot 100 %).
    const remaining = baseTotal
    let acc = 0
    const result: typeof out = []
    for (const o of out) {
      const room = Math.max(0, remaining - acc)
      const capped = Math.min(o.discountAmount, room)
      acc += capped
      result.push({ ...o, discountAmount: round2(capped) })
    }
    return result
  }
  return out
}

/** Immutabilni posnetek promocije za Order/Appointment. */
export function buildPromotionSnapshot(
  rule: PromotionRule,
  result: { baseAmount: number; discountAmount: number; affectedLines: number }
): PromotionSnapshot {
  return {
    promotionId: rule.id,
    name: rule.name,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    scope: rule.scope,
    targetEntityIds: [...rule.targetEntityIds],
    code: rule.code ?? null,
    baseAmount: result.baseAmount,
    discountAmount: result.discountAmount,
    affectedLines: result.affectedLines,
    appliedAt: new Date().toISOString(),
  }
}