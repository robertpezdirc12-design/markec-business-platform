// ============================================================
// PLATFORM HOSTS — env parsing (#102 follow-up)
//
// The proxy decides "platform root" vs "tenant host" from this
// list. A missing host does not crash — it silently turns the
// platform homepage into a tenant 404, which is exactly what
// happened on Vercel: `VERCEL_URL` is PER-DEPLOYMENT, so the
// stable production alias was treated as a tenant host.
// PLATFORM_HOSTS closes that hole with an explicit list.
// ============================================================

import { afterEach, describe, expect, it, vi } from "vitest"
import { getPlatformHostsFromEnv } from "../../src/lib/domains/platform-hosts"

const ENV_KEYS = [
  "PLATFORM_HOSTS",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_URL",
  "VERCEL_URL",
] as const

function clearEnv() {
  for (const key of ENV_KEYS) vi.stubEnv(key, "")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getPlatformHostsFromEnv", () => {
  it("vrne prazno brez okolja (nikoli ne vrže)", () => {
    clearEnv()
    expect(getPlatformHostsFromEnv()).toEqual([])
  })

  it("PLATFORM_HOSTS: vejica, shema, pot in port se normalizirajo na hostname", () => {
    clearEnv()
    vi.stubEnv(
      "PLATFORM_HOSTS",
      " https://markec.example.com/pricing , markec.si:3008,  bare-host.test "
    )
    expect(getPlatformHostsFromEnv()).toEqual([
      "markec.example.com",
      "markec.si",
      "bare-host.test",
    ])
  })

  it("obstoječe vire (NEXT_PUBLIC_APP_URL / NEXTAUTH_URL / VERCEL_URL) ohrani", () => {
    clearEnv()
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://markec-business-platform.robert-pezdirc12.workers.dev")
    vi.stubEnv("NEXTAUTH_URL", "https://markec.si")
    vi.stubEnv("VERCEL_URL", "markec-business-platform-abc123.vercel.app")
    expect(getPlatformHostsFromEnv()).toEqual([
      "markec-business-platform.robert-pezdirc12.workers.dev",
      "markec.si",
      "markec-business-platform-abc123.vercel.app",
    ])
  })

  it("prazni in neveljavni vnosi so preskočeni (brez \"null\" hostov)", () => {
    clearEnv()
    vi.stubEnv("PLATFORM_HOSTS", " , ,,")
    expect(getPlatformHostsFromEnv()).toEqual([])
  })
})
