"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"

// ============================================================
// FAZA 2C-2 — zgodovina selitev čebeljih družin (colony_move)
//
// Univerzalni vzorec MARKEC: append-only zgodovinski dogodki, ki spreminjajo
// trenutno stanje poslovnega zapisa. `colony.hive_ref` ostane edini vir
// trenutne lokacije; `colony_move` (ExtensionRecord, appendOnly) je zgodovina.
//
// - createColonyMove   — NAMENSKA strežniška akcija (edina pot ustvarjanja).
// - Generični records.ts CRUD vrne APPEND_ONLY za appendOnly entitete.
// - Vse v eni transakciji (baseline + event + hive_ref), z row-lock na družini
//   za sočasne zahteve. performed_by iz seje, browser nikoli.
// ============================================================

export interface ColonyMoveResult {
  ok: boolean
  id?: string
  /** Strojno prepoznavna napaka: INVALID / SAME_HIVE / STALE_MOVED_AT / STATE_MISMATCH / DUPLICATE / FORBIDDEN */
  error?: string
  message?: string
}

const COLONY_EXT = "bee-apiary"
const COLONY_KEY = "colony"
const HIVE_KEY = "hive"
const MOVE_KEY = "colony_move"

// TSUMD helper — zgodovinski dogodki so ExtensionRecord z entityKey=colony_move.
type MoveEvent = {
  id: string
  data: Record<string, unknown>
  createdAt: Date
}

async function lastMoveForColony(
  tx: Prisma.TransactionClient,
  orgId: string,
  colonyId: string
): Promise<MoveEvent | null> {
  const rows = await tx.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: MOVE_KEY, extensionId: COLONY_EXT },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const moves = rows.filter(
    (r) => (r.data as Record<string, unknown>)?.colony_ref === colonyId
  )
  return moves.length ? (moves[moves.length - 1] as MoveEvent) : null
}

import type { Prisma } from "@prisma/client"

/**
 * Sign-al napaka znotraj transakcije. Metam throw — da $transaction v vsakem
 * primeru rollback-a (fail-return s `{ok:false}` nikoli ne sme potencialno
 * potrditi delno izvedenih write). Zunanja akcija ujame in vrne {ok:false}.
 */
class ColonyMoveError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * NAMENSKA akcija: zapis selitve družine v panj, append-only.
 * Vse preveritve na strežniku + org-scoped. Ena transakcija.
 */
export async function createColonyMove(input: {
  colonyId: string
  toHiveId: string
  fromHiveId?: string
  movedAt?: string | null
  reason?: string
}): Promise<ColonyMoveResult> {
  const { session, org } = await requirePermissionOrg("workorders.manage")
  const performedById: string | undefined = session.user.id
  if (!performedById) return { ok: false, error: "FORBIDDEN", message: "No identity" }

  const { reason, movedAt } = input

  // Datum selitve: zanesljiv sistemski, če ni podan (podan se še vedno poisčm za preskok).
  let movedDate: Date
  try {
    movedDate = movedAt ? new Date(movedAt) : new Date()
    if (Number.isNaN(movedDate.getTime())) throw new Error("bad date")
  } catch {
    return { ok: false, error: "INVALID", message: "movedAt is not a valid date" }
  }

  let result: ColonyMoveResult
  try {
    result = await prisma.$transaction(async (tx) => {
    // Row-lock na družini → sočasne selitve iste družine se serializujejo.
    // (ščiti tudi pred podvajanjem za isto dodatno zahtevo med/po prvi)
    try {
      await tx.$queryRaw`SELECT id FROM "ExtensionRecord" WHERE id = ${input.colonyId} FOR UPDATE`
    } catch {
      // tabla obstaja; če družine ni, jo spodaj ugotovimo
    }

    // 1) Družina mora obstajati v ISTI org + biti entity 'colony' bee-apiary.
    const colony = await tx.extensionRecord.findFirst({
      where: { id: input.colonyId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: COLONY_KEY },
      select: { id: true, data: true },
    })
    if (!colony) throw new ColonyMoveError("INVALID", "Colony not found in org")

    // 2) Ciljni panj v ISTI org + entity 'hive'.
    const toHive = await tx.extensionRecord.findFirst({
      where: { id: input.toHiveId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: HIVE_KEY },
      select: { id: true },
    })
    if (!toHive) throw new ColonyMoveError("INVALID", "Target hive not found in org")

    // 3) Izvorni panj (če podan) preverimo; ne sme biti enak cilju.
    let fromValidated: string | null = null
    if (input.fromHiveId) {
      const fh = await tx.extensionRecord.findFirst({
        where: { id: input.fromHiveId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: HIVE_KEY },
        select: { id: true },
      })
      if (!fh) throw new ColonyMoveError("INVALID", "From-hive not found in org")
      if (fh.id === toHive.id) throw new ColonyMoveError("SAME_HIVE", "Cannot move into the same hive")
      fromValidated = fh.id
    }

    // 4) Trenutna lokacija iz colony.hive_ref (edini vir resnice; legacy text NI).
    const colonyData = (colony.data ?? {}) as Record<string, unknown>
    const currentHiveRef = typeof colonyData.hive_ref === "string" ? colonyData.hive_ref : null

    // 5) Zgodovina za to družino (append order = recordedAt/createdAt).
    const last = await lastMoveForColony(tx, org.id, input.colonyId)

    // 6) Baseline + pravila prve / poznejše selitve.
    let baselineData: Record<string, unknown> | null = null
    let originUnknown = false
    let finalFrom = fromValidated

    if (!last) {
      // DRUŽINA BREZ ZGODOVINE → prva selitev.
      if (currentHiveRef) {
        // Primer A: znana začetna lokacija → baseline z lokacijo A (movedAt=null).
        baselineData = {
          colony_ref: input.colonyId,
          to_hive_ref: currentHiveRef,
          from_hive_ref: null,
          moved_at: null,
          recorded_at: new Date().toISOString(),
          reason: "Stanje ob uvedbi evidence",
          performed_by: performedById,
          baseline: true,
          origin_unknown: false,
        }
        finalFrom = currentHiveRef
      } else {
        // Primer B: začetna lokacija NEZNANA → brez lažnega baseline-a.
        originUnknown = true
        finalFrom = null
      }
    }

    // SAME_HIVE: selitev v isti panj ni smiselna (kadar je izvor znan).
    if (finalFrom && finalFrom === input.toHiveId) {
      throw new ColonyMoveError("SAME_HIVE", "Cannot move into the same hive")
    }

    // primer C / pozneje: preveri, da je trenutno stanje skladno z zadnjim dogodkom.
    if (last) {
      const lastData = last.data as Record<string, unknown>
      const lastTo = typeof lastData.to_hive_ref === "string" ? lastData.to_hive_ref : null
      if (lastTo && currentHiveRef && lastTo !== currentHiveRef) {
        // Neskladje → NIKOLI ne popravljamo samodejno.
        throw new ColonyMoveError("STATE_MISMATCH", "Current hive_ref is out of sync with history")
      }
      // trenutna lokacija za primer B (izvor neznan):
      if (!currentHiveRef && lastTo && !lastData.baseline) {
        // brez znane lokacije a obstaja zgodovina — skladnost ročno: lastTo velja.
        // (pri prvem vnosu brez lokacije bi se trenutna nastavila na toHive spodaj)
      }
      const lastMoved = typeof lastData.moved_at === "string" || lastData.moved_at ? new Date(lastData.moved_at as string) : null
      if (lastMoved && !Number.isNaN(lastMoved.getTime()) && movedDate.getTime() < lastMoved.getTime()) {
        // Naknadni vnos S STAREJŠIM datumom od zadnjega dogodka → prepoved »nelogične« zgodovine.
        throw new ColonyMoveError("STALE_MOVED_AT", "movedAt older than the latest event")
      }
    }

    // 7) Podvojeni dogodek? (isti colony + od-do + datum selitve, brez baseline-a)
    const dupMoves = await tx.extensionRecord.findMany({
      where: { organizationId: org.id, extensionId: COLONY_EXT, entityKey: MOVE_KEY },
      select: { id: true, data: true },
    })
    const sameDup = dupMoves.find((m) => {
      const d = m.data as Record<string, unknown>
      if (d.baseline === true || d.isCorrection === true) return false
      if (d.colony_ref !== input.colonyId) return false
      if (d.to_hive_ref !== input.toHiveId) return false
      if ((d.from_hive_ref ?? null) !== (finalFrom ?? null)) return false
      if (d.movedAt) return new Date(d.movedAt as string).getTime() === movedDate.getTime()
      return false
    })
    if (sameDup) throw new ColonyMoveError("DUPLICATE", "Identical move already recorded")

    // 8) VSTAVI: [baseline] + event + update colony.hive_ref, atomarno.
    const eventData: Record<string, unknown> = {
      colony_ref: input.colonyId,
      from_hive_ref: finalFrom,
      to_hive_ref: input.toHiveId,
      moved_at: movedDate.toISOString(),
      recorded_at: new Date().toISOString(),
      reason: reason ?? null,
      performed_by: performedById,
      baseline: false,
      origin_unknown: originUnknown,
      is_correction: false,
    }

    if (baselineData) {
      await tx.extensionRecord.create({
        data: {
          organizationId: org.id,
          extensionId: COLONY_EXT,
          entityKey: MOVE_KEY,
          title: `Baseline ${COLONY_EXT}/${COLONY_KEY}`,
          data: baselineData as Prisma.InputJsonValue,
        },
      })
    }

    const event = await tx.extensionRecord.create({
      data: {
        organizationId: org.id,
        extensionId: COLONY_EXT,
        entityKey: MOVE_KEY,
        title: `Move ${input.colonyId} → ${input.toHiveId}`,
        data: eventData as Prisma.InputJsonValue,
      },
    })

    // Posodobi trenutno lokacijo (edini vir). Brez tega dviga neskladje.
    await tx.extensionRecord.update({
      where: { id: input.colonyId },
      data: { data: { ...colonyData, hive_ref: input.toHiveId } as Prisma.InputJsonValue },
    })

    return { ok: true, id: event.id } as ColonyMoveResult
    })
  } catch (e) {
    if (e instanceof ColonyMoveError) {
      return { ok: false, error: e.code, message: e.message }
    }
    throw e
  }

  revalidatePath("/dashboard/records")
  return result
}

/**
 * KOREKCIJSKI dogodek (Faza 2C-2): popravlja napačen dogodek selitve.
 * — Originalni dogodek ostane nespremenjen (append-only se ne krši).
 * — Ustvari NOV dogodek z isCorrection=true, corrects_ref=<original.id>,
 *   correctionReason, movedAt=nov datum, ter posodobi hive_ref na novi panj.
 * Ne omogoča popraviti preteklih/nekdaj zgodovine; trenutna lokacija sledi
 * zadnjemu veljavnemu dogodku (korekcija je zadnja).
 */
export async function correctColonyMove(
  originalId: string,
  input: { toHiveId: string; reason?: string }
): Promise<ColonyMoveResult> {
  const { session, org } = await requirePermissionOrg("workorders.manage")
  const performedById = session.user.id
  if (!performedById) return { ok: false, error: "FORBIDDEN" }

  try {
    return await prisma.$transaction(async (tx) => {
    const original = await tx.extensionRecord.findFirst({
      where: { id: originalId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: MOVE_KEY },
      select: { id: true, data: true },
    })
    if (!original) throw new ColonyMoveError("INVALID", "Original event not found")
    const odata = original.data as Record<string, unknown>
    const colonyId = typeof odata.colony_ref === "string" ? odata.colony_ref : ""
    if (!colonyId) throw new ColonyMoveError("INVALID", "Original event has no colony")

    // varnost pred se-after-lock (podobno create)
    await tx.$queryRaw`SELECT id FROM "ExtensionRecord" WHERE id = ${colonyId} FOR UPDATE`

    // novi cilj mora biti v isti org
    const toHive = await tx.extensionRecord.findFirst({
      where: { id: input.toHiveId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: HIVE_KEY },
      select: { id: true },
    })
    if (!toHive) throw new ColonyMoveError("INVALID", "Target hive not found in org")

    const colony = await tx.extensionRecord.findFirst({
      where: { id: colonyId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: COLONY_KEY },
      select: { data: true },
    })
    const cdata = (colony?.data ?? {}) as Record<string, unknown>

    await tx.extensionRecord.create({
      data: {
        organizationId: org.id,
        extensionId: COLONY_EXT,
        entityKey: MOVE_KEY,
        title: `Correction of ${original.id}`,
        data: {
          colony_ref: colonyId,
          to_hive_ref: input.toHiveId,
          from_hive_ref: odata.to_hive_ref ?? null,
          moved_at: new Date().toISOString(),
          recorded_at: new Date().toISOString(),
          reason: odata.reason ?? null,
          performed_by: performedById,
          baseline: false,
          origin_unknown: false,
          is_correction: true,
          corrects_ref: original.id,
          correction_reason: input.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    })
    await tx.extensionRecord.update({
      where: { id: colonyId },
      data: { data: { ...cdata, hive_ref: input.toHiveId } as Prisma.InputJsonValue },
    })
    return { ok: true } as ColonyMoveResult
    })
  } catch (e) {
    if (e instanceof ColonyMoveError) return { ok: false, error: e.code, message: e.message }
    throw e
  }
}

/**
 * Rekonstrukcija lokacije družine na izbran datum (brez UI, za strežniška
 * poročila/teste). Vrni { location: string|null, known: boolean }.
 */
export async function colonyLocationAt(colonyId: string, when: Date): Promise<{
  locationId: string | null
  known: boolean
  baselineOnly: boolean
}> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const colony = await prisma.extensionRecord.findFirst({
    where: { id: colonyId, organizationId: org.id },
    select: { data: true, id: true },
  })
  if (!colony) return { locationId: null, known: false, baselineOnly: false }
  const moves = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, extensionId: COLONY_EXT, entityKey: MOVE_KEY },
    select: { data: true, createdAt: true },
  })
  const rel = moves
    .filter((m) => (m.data as Record<string, unknown>)?.colony_ref === colonyId)
    .map((m) => m.data as Record<string, unknown>)
  // dogodki z movedAt <= when, sort po movedAt
  const dated = rel
    .filter((m) => m.moved_at && !m.baseline)
    .sort((a, b) => new Date(a.moved_at as string).getTime() - new Date(b.moved_at as string).getTime())
  for (let i = dated.length - 1; i >= 0; i--) {
    if (new Date(dated[i].moved_at as string).getTime() <= when.getTime()) {
      const hiveRef = dated[i].to_hive_ref
      const to = typeof hiveRef === "string" ? hiveRef : null
      return { locationId: to, known: to !== null, baselineOnly: false }
    }
  }
  // nobenega datiranega dogodka pred 'when' → v domeni baseline ali neznano
  const bl = rel.find((m) => m.baseline === true)
  if (bl && typeof bl.to_hive_ref === "string" && (typeof bl.recorded_at !== "string" || when >= new Date(bl.recorded_at as string))) {
    return { locationId: bl.to_hive_ref as string, known: true, baselineOnly: true }
  }
  if (bl) {
    // pred začetkom zanesljive evidence → ni zanesljivo
    return { locationId: null, known: false, baselineOnly: true }
  }
  return { locationId: null, known: false, baselineOnly: false }
}

/** Seznam zgodovine selitev za družino (append order) — brez UI.
 *  Faza 2C-3: razširjen izhod (recordedAt/reason/isCorrection/correctsRef/correctionReason) —
 *  poslovna logika in pravila se NISO spreminjala, le izhodni tip je bogatejši. */
export async function listColonyMoveHistory(colonyId: string): Promise<{
  ok: boolean
  events: {
    id: string
    fromHiveId: string | null
    toHiveId: string
    movedAt: string | null
    recordedAt: string | null
    reason: string | null
    baseline: boolean
    originUnknown: boolean
    performedById?: string
    isCorrection: boolean
    correctsRef: string | null
    correctionReason: string | null
    createdAt: string
  }[]
}> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const col = await prisma.extensionRecord.findFirst({
    where: { id: colonyId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: COLONY_KEY },
    select: { id: true },
  })
  if (!col) return { ok: false, events: [] }
  const rows = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, extensionId: COLONY_EXT, entityKey: MOVE_KEY },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const rel = rows
    .filter((r) => (r.data as Record<string, unknown>)?.colony_ref === colonyId)
    .map((r) => {
      const d = r.data as Record<string, unknown>
      return {
        id: r.id,
        fromHiveId: typeof d.from_hive_ref === "string" ? d.from_hive_ref : null,
        toHiveId: typeof d.to_hive_ref === "string" ? d.to_hive_ref : "",
        movedAt: typeof d.moved_at === "string" ? d.moved_at : null,
        recordedAt: typeof d.recorded_at === "string" ? d.recorded_at : null,
        reason: typeof d.reason === "string" ? d.reason : null,
        baseline: d.baseline === true,
        originUnknown: d.origin_unknown === true,
        performedById: typeof d.performed_by === "string" ? d.performed_by : undefined,
        isCorrection: d.is_correction === true,
        correctsRef: typeof d.corrects_ref === "string" ? d.corrects_ref : null,
        correctionReason: typeof d.correction_reason === "string" ? d.correction_reason : null,
        createdAt: r.createdAt.toISOString(),
      }
    })
  return { ok: true, events: rel }
}

/**
 * FAZA 2C-3 — UI-om prijazna akcija (additive; logika 2C-2 se ne spreminja).
 * Razreši zgodovino selitev + imena izvajalcev + nazive panjev/postaje, org-scoped.
 * performed_by se NIKOLI ne sprejme iz browserja — beremo obstoječo vrednost, ki jo
 * je strežnik shranil ob dogodku. Imena uporabnikov razrešujemo le za člane ISKE org
 * (OrganizationMember ∩ User); vsi ostali → "Neznan uporabnik" (ne razkrivamo tujih).
 */
export async function listColonyMoveDetail(colonyId: string): Promise<{
  ok: boolean
  colonyLabel: string | null
  currentHiveId: string | null
  currentHiveTitle: string | null
  currentApiaryTitle: string | null
  events: {
    id: string
    fromHiveId: string | null
    toHiveId: string
    fromHiveTitle: string | null
    toHiveTitle: string
    movedAt: string | null
    recordedAt: string | null
    reason: string | null
    baseline: boolean
    originUnknown: boolean
    performedById: string | null
    performedByName: string | null
    isCorrection: boolean
    correctsRef: string | null
    correctionReason: string | null
    createdAt: string
  }[]
}> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const colony = await prisma.extensionRecord.findFirst({
    where: { id: colonyId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: COLONY_KEY },
    select: { data: true, title: true },
  })
  if (!colony) return { ok: false, colonyLabel: null, currentHiveId: null, currentHiveTitle: null, currentApiaryTitle: null, events: [] }
  const colonyData = (colony.data ?? {}) as Record<string, unknown>
  const currentHiveId = typeof colonyData.hive_ref === "string" ? colonyData.hive_ref : null
  const colonyLabel = typeof colonyData.label === "string" ? colonyData.label : colony.title

  const hist = await listColonyMoveHistory(colonyId)
  if (!hist.ok) {
    return { ok: false, colonyLabel, currentHiveId, currentHiveTitle: null, currentApiaryTitle: null, events: [] }
  }

  // gathering ids: izvajalci + panji (from/to/current)
  const userIds = Array.from(
    new Set(hist.events.map((e) => e.performedById).filter((x): x is string => !!x))
  )
  const hiveIds = Array.from(
    new Set<string>([
      ...hist.events.map((e) => e.fromHiveId).filter((x): x is string => !!x),
      ...hist.events.map((e) => e.toHiveId).filter((x): x is string => !!x),
      ...(currentHiveId ? [currentHiveId] : []),
    ])
  )

  // imena izvajalcev (samo člani iste org)
  let nameById: Record<string, string> = {}
  if (userIds.length) {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: org.id, userId: { in: userIds } },
      select: { userId: true },
    })
    const memberIds = members.map((m) => m.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    })
    nameById = Object.fromEntries(
      users.map((u) => [u.id, u.name ?? "uknown"])
    )
  }
  const revealName = (id: string | undefined) => (id && nameById[id]) || null

  // nazivi panjev + postaje
  let hiveTitleBy: Record<string, string> = {}
  if (hiveIds.length) {
    const hives = await prisma.extensionRecord.findMany({
      where: { id: { in: hiveIds }, organizationId: org.id, extensionId: COLONY_EXT, entityKey: HIVE_KEY },
      select: { id: true, title: true, data: true },
    })
    hiveTitleBy = Object.fromEntries(hives.map((h) => [h.id, h.title]))
  }
  const currentHiveTitle = currentHiveId ? (hiveTitleBy[currentHiveId] ?? null) : null
  let currentApiaryTitle: string | null = null
  if (currentHiveId) {
    const hiveRow = await prisma.extensionRecord.findFirst({
      where: { id: currentHiveId, organizationId: org.id, extensionId: COLONY_EXT, entityKey: HIVE_KEY },
      select: { data: true },
    })
    const apiaryRef = (hiveRow?.data as Record<string, unknown> | null)?.apiary_ref
    if (typeof apiaryRef === "string") {
      const ap = await prisma.extensionRecord.findFirst({
        where: { id: apiaryRef, organizationId: org.id, extensionId: COLONY_EXT, entityKey: "apiary" },
        select: { title: true },
      })
      currentApiaryTitle = ap?.title ?? null
    }
  }

  const events = hist.events.map((e) => ({
    id: e.id,
    fromHiveId: e.fromHiveId,
    toHiveId: e.toHiveId,
    fromHiveTitle: e.fromHiveId ? (hiveTitleBy[e.fromHiveId] ?? null) : null,
    toHiveTitle: hiveTitleBy[e.toHiveId] ?? e.toHiveId,
    movedAt: e.movedAt,
    recordedAt: e.recordedAt,
    reason: e.reason ?? null,
    baseline: e.baseline,
    originUnknown: e.originUnknown,
    performedById: e.performedById ?? null,
    performedByName: revealName(e.performedById),
    isCorrection: e.isCorrection,
    correctsRef: e.correctsRef ?? null,
    correctionReason: e.correctionReason ?? null,
    createdAt: e.createdAt,
  }))

  return {
    ok: true,
    colonyLabel,
    currentHiveId,
    currentHiveTitle,
    currentApiaryTitle,
    events,
  }
}