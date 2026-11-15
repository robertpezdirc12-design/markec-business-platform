import { describe, it, expect } from "vitest"
import {
  stripIgnoredSchemas,
  appSchemaSignature,
  hasSchemaDiff,
  shouldFlagDrift,
} from "../scripts/check-preview-schema-drift.mjs"

// Neonov pg_dump vsak objekt uvede z `-- Name: …; Type: …; Schema: …; Owner: …`.
// Skript mora ignorirati interno shemo neon_auth (Neon Auth jo spreminja sam),
// nikakor pa ne sme ignorirati razlik v shemi public, ki jo upravlja Prisma.
const obj = (schema: string, name: string, ddl: string) =>
  `-- Name: ${name}; Type: TABLE; Schema: ${schema}; Owner: neondb_owner\n${ddl}`

const publicUser = obj("public", "User", 'CREATE TABLE public."User" ( id text );')
const publicOrder = obj("public", "Order", 'CREATE TABLE public."Order" ( id text );')
const authOld = obj(
  "neon_auth",
  "project_config",
  "CREATE TABLE neon_auth.project_config ( webhook_config jsonb );",
)
const authNew = obj(
  "neon_auth",
  "project_config",
  "CREATE TABLE neon_auth.project_config ( webhook_config jsonb, auth_logs_export_enabled boolean DEFAULT false );",
)
const dump = (authBlock: string, userDdl = publicUser) =>
  ["-- pg_dump preamble", userDdl, authBlock, publicOrder].join("\n")

describe("stripIgnoredSchemas", () => {
  it("odstrani neon_auth blok, ohrani public objekte in uvod", () => {
    const out = stripIgnoredSchemas(dump(authNew))
    expect(out).toContain("pg_dump preamble")
    expect(out).toContain('public."User"')
    expect(out).toContain('public."Order"')
    expect(out).not.toContain("auth_logs_export_enabled")
    expect(out).not.toContain("neon_auth.project_config")
  })

  it("prazen vhod ne pade, neznani shemi ne odstrani", () => {
    expect(stripIgnoredSchemas("")).toBe("")
    expect(stripIgnoredSchemas(publicUser)).toContain('public."User"')
  })
})

describe("appSchemaSignature", () => {
  it("enak podpis, če se spremeni samo neon_auth blok", () => {
    expect(appSchemaSignature(dump(authOld))).toBe(appSchemaSignature(dump(authNew)))
  })

  it("drugačen podpis ob spremembi public tabele (prava Prisma migracija)", () => {
    const changedUser = obj(
      "public",
      "User",
      'CREATE TABLE public."User" ( id text, new_column text );',
    )
    expect(appSchemaSignature(dump(authOld, publicUser))).not.toBe(
      appSchemaSignature(dump(authOld, changedUser)),
    )
  })
})

describe("hasSchemaDiff", () => {
  it("prazen in JSON-prazen odziv nista diff", () => {
    expect(hasSchemaDiff("")).toBe(false)
    expect(hasSchemaDiff('""')).toBe(false)
    expect(hasSchemaDiff(undefined)).toBe(false)
  })

  it("pravi unified diff je diff — ne sme se prezgodaj vrniti OK", () => {
    expect(hasSchemaDiff("--- a/neondb\n+++ b/neondb\n@@ -1 +1 @@\n-x\n+y")).toBe(true)
  })
})

describe("shouldFlagDrift", () => {
  it("prazen diff ni odmik", () => {
    expect(shouldFlagDrift({ diff: "", appSchemaEqual: false })).toBe(false)
    expect(shouldFlagDrift({ diff: '""', appSchemaEqual: false })).toBe(false)
  })

  it("surovi diff z ujemajočo aplikacijsko shemo je ignoriran", () => {
    expect(shouldFlagDrift({ diff: "--- a/x\n+++ b/x", appSchemaEqual: true })).toBe(false)
  })

  it("--strict obdrži staro strogo obnašanje", () => {
    expect(
      shouldFlagDrift({ diff: "--- a/x\n+++ b/x", appSchemaEqual: true, strict: true }),
    ).toBe(true)
  })

  it("različna aplikacijska shema je vedno odmik", () => {
    expect(shouldFlagDrift({ diff: "--- a/x\n+++ b/x", appSchemaEqual: false })).toBe(true)
  })

  it("ko podpisa ni mogoče izračunati, odpove varno (fail-closed)", () => {
    expect(
      shouldFlagDrift({ diff: "--- a/x\n+++ b/x", appSchemaEqual: undefined }),
    ).toBe(true)
  })
})
