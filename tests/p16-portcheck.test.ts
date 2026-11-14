import { describe, it, expect, vi } from "vitest"
import {
  proxyResolverOrigin,
  resolverExpectedOrigin,
} from "../src/lib/tenant-proof"

// F2.2.2 P1.6 — dev server on a NON-default port must resolve the tenant;
// .env pinned to localhost:3000 must NOT force the proxy onto port 3000.
describe("P1.6 port-independent dev tenant resolution", () => {
  it("proxy uses the REQUEST origin (3001) when env is pinned to 3000, in dev", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
    expect(
      proxyResolverOrigin({ nextUrl: new URL("http://localhost:3001/s/demo-salon") })
    ).toBe("http://localhost:3001")
  })

  it("resolver verifies the REQUEST origin (3001), matching the proxy", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
    expect(
      resolverExpectedOrigin({ url: "http://localhost:3001/api/public/resolve-tenant?slug=x" })
    ).toBe("http://localhost:3001")
  })

  it("production preserves the env origin (isolation intact)", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://markec.example")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(
      proxyResolverOrigin({ nextUrl: new URL("http://attacker.example/s/salon") })
    ).toBe("https://markec.example")
  })
})