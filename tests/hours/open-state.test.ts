import { describe, it, expect } from "vitest"
import {
  openStateFor,
  parseTimeToMinutes,
  formatMinutes,
  weeklyHoursSummary,
  localDayAndMinutes,
  type OpeningHour,
} from "@/lib/hours/open-state"

// 2026-11-18 je SREDA (day = 3).
const WEDNESDAY_NOON = new Date("2026-11-18T11:00:00.000Z") // 12:00 v Ljubljani (CET)

const WEEKDAY_9_19: OpeningHour[] = [
  { day: 1, open: "09:00", close: "19:00" },
  { day: 2, open: "09:00", close: "19:00" },
  { day: 3, open: "09:00", close: "19:00" },
  { day: 4, open: "09:00", close: "19:00" },
  { day: 5, open: "09:00", close: "19:00" },
  { day: 6, open: null, close: null },
  { day: 0, open: null, close: null },
]

describe("parseTimeToMinutes / formatMinutes", () => {
  it("razume HH:MM in zavrne neveljavno", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570)
    expect(parseTimeToMinutes("9:05")).toBe(545)
    expect(parseTimeToMinutes("24:00")).toBeNull()
    expect(parseTimeToMinutes("9:60")).toBeNull()
    expect(parseTimeToMinutes(null)).toBeNull()
    expect(parseTimeToMinutes("zjutraj")).toBeNull()
  })

  it("formatira minute nazaj v HH:MM", () => {
    expect(formatMinutes(1140)).toBe("19:00")
    expect(formatMinutes(0)).toBe("00:00")
    expect(formatMinutes(1440 + 60)).toBe("01:00")
  })
})

describe("localDayAndMinutes", () => {
  it("uporabi časovni pas salona (Ljubljana), ne UTC", () => {
    const { day, minutes } = localDayAndMinutes(WEDNESDAY_NOON, "Europe/Ljubljana")
    expect(day).toBe(3)
    expect(minutes).toBe(12 * 60)
  })
})

describe("openStateFor", () => {
  it("odprto sredi delovnega dne pove, do kdaj je odprto", () => {
    const state = openStateFor(WEEKDAY_9_19, WEDNESDAY_NOON)
    expect(state.state).toBe("open")
    expect(state.until).toBe("19:00")
    expect(state.label).toBe("Odprto do 19:00")
  })

  it("pred odprtjem pove, kdaj se odpre danes", () => {
    // 07:00 v Ljubljani
    const state = openStateFor(WEEKDAY_9_19, new Date("2026-11-18T06:00:00.000Z"))
    expect(state.state).toBe("closed")
    expect(state.label).toBe("Zaprto · odpre se danes ob 9:00")
  })

  it("po zaprtju pove, kdaj se odpre jutri", () => {
    // 20:30 v Ljubljani
    const state = openStateFor(WEEKDAY_9_19, new Date("2026-11-18T19:30:00.000Z"))
    expect(state.state).toBe("closed")
    expect(state.label).toBe("Zaprto · odpre se jutri ob 9:00")
  })

  it("ob koncu tedna skoči na ponedeljek", () => {
    // sobota 12:00 — zaprto, naslednje odprtje je v ponedeljek
    const state = openStateFor(WEEKDAY_9_19, new Date("2026-11-21T11:00:00.000Z"))
    expect(state.state).toBe("closed")
    expect(state.label).toBe("Zaprto · odpre se v ponedeljek ob 9:00")
  })

  it("podpira prelom čez polnoč", () => {
    const late: OpeningHour[] = [
      { day: 3, open: "22:00", close: "02:00" },
    ]
    // četrtek 01:00 — še odprto od srede
    const state = openStateFor(late, new Date("2026-11-19T00:00:00.000Z"))
    expect(state.state).toBe("open")
    expect(state.until).toBe("02:00")
  })

  it("brez podatkov ne trdi ničesar", () => {
    expect(openStateFor([], WEDNESDAY_NOON).state).toBe("unknown")
    expect(openStateFor(null, WEDNESDAY_NOON).label).toBe("")
    expect(openStateFor(WEEKDAY_9_19, WEDNESDAY_NOON, "Europe/Ljubljana").state).toBe("open")
  })
})

describe("weeklyHoursSummary", () => {
  it("strne enake dni v en razpon", () => {
    const summary = weeklyHoursSummary(WEEKDAY_9_19)
    expect(summary).toContain("pon, tor, sre, čet, pet 09:00–19:00")
  })
})
