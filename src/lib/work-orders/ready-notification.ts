// ============================================================
// »PRIPRAVLJENO ZA PREVZEM« — odločitev IN obvestilo
//
// Ko naročilo preide v stopnjo predaje, mora stranka to izvedeti.
// Odločitev (katera stopnja je »pripravljeno«) je čista funkcija, da jo
// je mogoče testirati brez DB; pošiljanje pa je ločeno in se zgodi šele,
// ko je e-poštni servis nastavljen (brez RESEND ključa se nič ne pošlje
// in nič ne laže).
// ============================================================

/** Vzorec ključa/imen stopnje, ki pomenijo »pripravljeno za prevzem«. */
export const READY_STAGE_PATTERN = /delivery|predaja|prevzem|ready|pickup/i

/** Ali prehod V to stopnjo pomeni, da je naročilo pripravljeno? */
export function isReadyStage(stage: {
  key?: string | null
  name?: string | null
}): boolean {
  return (
    READY_STAGE_PATTERN.test(stage.key ?? "") ||
    READY_STAGE_PATTERN.test(stage.name ?? "")
  )
}

/** Ali naj obvestilo odide? Samo ob prehodu V pripravljeno stopnjo. */
export function shouldNotifyReady(params: {
  fromStageKey: string | null
  toStageKey: string | null
  toStageName: string | null
}): boolean {
  const target = { key: params.toStageKey, name: params.toStageName }
  if (!isReadyStage(target)) return false
  // Če smo že bili v tej stopnji (ponovno shranjevanje), ne pošiljamo znova.
  return params.fromStageKey !== params.toStageKey
}

/** Besedilo sporočila (SL) — eno mesto za predmet in telo. */
export function readyEmailContent(params: {
  businessName: string
  customerName: string | null
  orderNumber: number
  orderTitle: string
  dueDateLabel: string | null
  totalLabel: string | null
  publicUrl: string | null
}): { subject: string; lines: string[] } {
  const ref = `#${String(params.orderNumber).padStart(3, "0")}`
  const lines = [
    params.customerName
      ? `Pozdravljeni, ${params.customerName}!`
      : "Pozdravljeni!",
    `Vaše naročilo ${ref} (${params.orderTitle}) je pripravljeno za prevzem.`,
  ]
  if (params.dueDateLabel) lines.push(`Rok: ${params.dueDateLabel}.`)
  if (params.totalLabel) lines.push(`Znesek: ${params.totalLabel}.`)
  if (params.publicUrl) {
    lines.push(`Podrobnosti in plačilo: ${params.publicUrl}`)
  }
  lines.push(`Lep pozdrav, ${params.businessName}`)
  return { subject: `Pripravljeno za prevzem — ${ref} ${params.orderTitle}`, lines }
}
