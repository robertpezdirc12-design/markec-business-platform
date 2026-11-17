// ============================================================
// ODPRT/ZAPRT — ena čista funkcija za vse površine.
//
// Audit 2026-11-18 (Fresha primerjava): Fresha na strani podjetja piše
// "Closed - opens on Wednesday at 7:00 AM"; MARKEC je imel v snapshotu
// polji isOpen/openUntil, ki ju nihče ni napolnil (kartica jih ni nikoli
// prikazala), podjetje pa ni nikjer povedalo, ali je odprto.
//
// Pravila:
//  - delovni čas je v lokalnem času SALONA (Europe/Ljubljana),
//  - prelom čez polnoč (npr. 22:00–02:00) je podprt,
//  - "zaprto" pove, kdaj se odpre naslednjič (v največ 7 dneh),
//  - brez podatkov → ne trdimo ničesar (state: "unknown").
// ============================================================

export interface OpeningHour {
  /** 0 = nedelja … 6 = sobota (enako kot v site-content). */
  day: number
  open: string | null
  close: string | null
}

export interface OpenState {
  state: "open" | "closed" | "unknown"
  /** "19:00" — do kdaj je odprto (samo ko je odprto). */
  until: string | null
  /** "sredo ob 9:00" — kdaj se odpre (samo ko je zaprto). */
  nextOpenLabel: string | null
  /** Kratek opis za oznako: "Odprto do 19:00" / "Zaprto · odpre se v sredo ob 9:00". */
  label: string
}

const DAY_NAMES_SL = [
  "nedeljo",
  "ponedeljek",
  "torek",
  "sredo",
  "četrtek",
  "petek",
  "soboto",
]

const DAY_NAMES_SL_SHORT = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"]

/** "9:00" → 540 minut; neveljavno → null. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Minute → "19:00". */
export function formatMinutes(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * Lokalni dan v tednu in minute od polnoči za dano časovno območje.
 * `now` je namenjen testom (privzeto new Date()).
 */
export function localDayAndMinutes(
  now: Date,
  timeZone = "Europe/Ljubljana"
): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun"
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    day: map[weekday] ?? 0,
    // Intl vrne "24" za polnoč v nekaterih okoljih.
    minutes: (hour % 24) * 60 + minute,
  }
}

export function openStateFor(
  hours: OpeningHour[] | undefined | null,
  now: Date = new Date(),
  timeZone = "Europe/Ljubljana"
): OpenState {
  const usable = (hours ?? []).filter(
    (h) => parseTimeToMinutes(h.open) !== null && parseTimeToMinutes(h.close) !== null
  )
  if (usable.length === 0) {
    return { state: "unknown", until: null, nextOpenLabel: null, label: "" }
  }

  const { day, minutes } = localDayAndMinutes(now, timeZone)

  for (const entry of usable) {
    const open = parseTimeToMinutes(entry.open)!
    const close = parseTimeToMinutes(entry.close)!
    const overnight = close <= open

    const isToday = entry.day === day
    const isYesterday = entry.day === ((day + 6) % 7)

    // Prek polnoči: včerajšnji termin, ki se še ni zaprl.
    if (overnight && isYesterday && minutes < close) {
      const until = formatMinutes(close)
      return {
        state: "open",
        until,
        nextOpenLabel: null,
        label: `Odprto do ${until}`,
      }
    }

    if (isToday && minutes >= open && (overnight ? true : minutes < close)) {
      const until = formatMinutes(close)
      return { state: "open", until, nextOpenLabel: null, label: `Odprto do ${until}` }
    }
  }

  // Zaprto — poiščemo naslednje odpiranje (do 7 dni naprej).
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDay = (day + offset) % 7
    const entry = usable.find((h) => h.day === candidateDay)
    if (!entry) continue
    const open = parseTimeToMinutes(entry.open)!
    if (offset === 0 && minutes >= open) continue
    const openLabel = formatMinutes(open).replace(/^0/, "")
    const dayLabel =
      offset === 0
        ? "danes"
        : offset === 1
          ? "jutri"
          : `v ${DAY_NAMES_SL[candidateDay]}`
    return {
      state: "closed",
      until: null,
      nextOpenLabel: `${dayLabel} ob ${openLabel}`,
      label: `Zaprto · odpre se ${dayLabel} ob ${openLabel}`,
    }
  }

  return { state: "closed", until: null, nextOpenLabel: null, label: "Zaprto" }
}

/**
 * Tedenski delovni čas strnjen v berljiv niz ("pon–pet 9:00–19:00").
 * Uporablja se v orodnih namigih in na strani podjetja.
 */
export function weeklyHoursSummary(hours: OpeningHour[] | undefined | null): string {
  const usable = (hours ?? []).filter(
    (h) => parseTimeToMinutes(h.open) !== null && parseTimeToMinutes(h.close) !== null
  )
  if (usable.length === 0) return ""
  // Grupiramo po enakem delovnem času (isti open–close) in zaporednih dnevih.
  const byTime = new Map<string, number[]>()
  for (const entry of usable) {
    const key = `${formatMinutes(parseTimeToMinutes(entry.open)!)}–${formatMinutes(
      parseTimeToMinutes(entry.close)!
    )}`
    const list = byTime.get(key) ?? []
    list.push(entry.day)
    byTime.set(key, list)
  }
  return [...byTime.entries()]
    .map(([range, days]) => {
      const sorted = [...days].sort((a, b) => a - b)
      const names = sorted.map((d) => DAY_NAMES_SL_SHORT[d]).join(", ")
      return `${names} ${range}`
    })
    .join(" · ")
}
