import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// U7 — operativni števci v admin navigaciji. Regresijska zaščita, da
// sidebar števce tudi pokliče (getNavCounters) in jih prikaže (badge),
// ter da sta prikazana ključna badge povezave na waitlist/chats.

const __dirname = dirname(fileURLToPath(import.meta.url))
const sidebarPath = join(__dirname, "../../src/components/admin/sidebar.tsx")
const actionPath = join(__dirname, "../../src/app/actions/nav-counters.ts")

describe("U7 sidebar nav counters", () => {
  it("sidebar uvozi in pokliče getNavCounters", async () => {
    const src = await readFile(sidebarPath, "utf8")
    expect(src).toContain('from "@/app/actions/nav-counters"')
    expect(src).toContain("getNavCounters()")
  })

  it("badge se veže na waitlist, chats in appointments", async () => {
    const src = await readFile(sidebarPath, "utf8")
    expect(src).toContain('"/dashboard/waitlist"')
    expect(src).toContain('"/dashboard/chats"')
    expect(src).toContain('"/dashboard/appointments"')
    // badge blok se renderira samo, ko je število > 0.
    expect(src).toContain("count > 0")
  })

  it("server action je org-scoped prek requirePermissionOrg", async () => {
    const src = await readFile(actionPath, "utf8")
    expect(src).toContain('requirePermissionOrg("appointments.view")')
    expect(src).toContain("prisma.conversation.count")
    expect(src).toContain("prisma.waitlistEntry.count")
    expect(src).toContain("prisma.appointment.count")
  })
})