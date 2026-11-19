// ============================================================
// JAVNA PREVERBA PROMOCIJSKE KODE (checkout)
//
// Za gumb "Preveri" ob polju za promo kodo. Preveri SAMO, da koda
// pripada aktivni, trenutno veljavni promociji tega najemnika in
// vrne ime + popust za predogled. Dejansko uveljavitev popusta in
// unovčenje še vedno opravi checkout action (avtoritativni motor).
// Org se razreši iz najemniškega proxyja (getPublicOrg), enako kot
// validateGiftCard — koda druge trgovine je zavrnjena.
// ============================================================

"use server"

import { getPublicOrg } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export type PromotionCodeCheck =
  | { ok: true; name: string; discountLabel: string; code: string }
  | { ok: false; message: string }

const eur = (n: number) =>
  n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" })

export async function checkPromotionCode(rawCode: string, locale: string = "sl"): Promise<PromotionCodeCheck> {
  const en = locale === "en"
  const org = await getPublicOrg()
  if (!org) {
    return { ok: false, message: en ? "Code does not exist." : "Koda ne obstaja." }
  }

  // Anti-zloraba (brute-force ugibanja kod): omejimo preverjanja na IP.
  // Fail-open — ob izpadu števca se preverjanje nadaljuje (zaščita, ne kviz).
  const ip = await getClientIp()
  const rl = await rateLimit({
    scope: "promo:ip",
    key: ip,
    limit: 20,
    windowMs: 15 * 60_000,
  })
  if (!rl.ok) {
    return { ok: false, message: en ? "Too many attempts. Please wait a few minutes." : "Preveč poskusov. Počakajte nekaj minut." }
  }

  const code = rawCode.trim().toUpperCase()
  if (!code) return { ok: false, message: en ? "Please enter a code." : "Vnesite kodo." }

  const promo = await prisma.promotion.findFirst({
    where: {
      organizationId: org.id,
      status: "ACTIVE",
      code,
    },
    select: {
      id: true,
      name: true,
      code: true,
      discountType: true,
      discountValue: true,
      startsAt: true,
      endsAt: true,
      maxRedemptions: true,
    },
  })

  if (!promo) return { ok: false, message: en ? "This promotion code is not valid." : "Ta promocijska koda ni veljavna." }

  const now = new Date()
  if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) {
    return { ok: false, message: en ? "This promotion has not started yet." : "Akcija s to kodo se še ni začela." }
  }
  if (promo.endsAt && promo.endsAt.getTime() < now.getTime()) {
    return { ok: false, message: en ? "This promotion has expired." : "Akcija s to kodo je potekla." }
  }

  // Anti-zloraba: če je skupna omejitev uporab dosežena, kode ni mogoče več
  // uporabiti — stranka to vidi že na "Preveri", ne šele pri zaključku.
  if (promo.maxRedemptions != null) {
    const used = await prisma.promotionRedemption.count({
      where: { promotionId: promo.id, status: "REDEEMED" },
    })
    if (used >= promo.maxRedemptions) {
      return { ok: false, message: en ? "This promotion has reached its maximum number of uses." : "Ta promocija je dosegla največje število uporab." }
    }
  }

  const value = Number(promo.discountValue)
  const discountLabel =
    promo.discountType === "PERCENT"
      ? `-${Math.round(value)} %`
      : `-${eur(value)}`

  return { ok: true, name: promo.name, discountLabel, code: promo.code ?? code }
}