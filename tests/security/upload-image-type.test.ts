// P1 (audit 2026-11) — preverjanje TIPA NALOŽENE SLIKE po vsebini.
//
// Ranljivost: `/api/upload` je sprejel vse `image/*`, torej tudi
// `image/svg+xml`. SVG se streže z istega izvora in lahko vsebuje `<script>`
// → shranjeni XSS (avatar lahko naloži vsak prijavljen uporabnik). Rešitev je
// whitelist rastrskih formatov + magic-byte preverjanje. Ti testi zaklepajo
// obnašanje, na katerem stojita `/api/upload` in `/api/upload/r2`.
import { describe, expect, it } from "vitest"
import {
  ALLOWED_IMAGE_MIME_TYPES,
  detectImageMime,
  validateImageUpload,
} from "@/lib/uploads/image-type"

const enc = (s: string) => new TextEncoder().encode(s)
const pad = (bytes: number[], total = 16) =>
  new Uint8Array([...bytes, ...new Array(Math.max(0, total - bytes.length)).fill(0)])

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0])
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF = pad([...enc("GIF89a")])
const WEBP = pad([...enc("RIFF"), 0, 0, 0, 0, ...enc("WEBP")])
const AVIF = pad([0, 0, 0, 0x20, ...enc("ftyp"), ...enc("avif")])

describe("detectImageMime — prepozna rastrske formate", () => {
  it.each([
    ["image/jpeg", JPEG],
    ["image/png", PNG],
    ["image/gif", GIF],
    ["image/webp", WEBP],
    ["image/avif", AVIF],
  ])("%s", (expected, bytes) => {
    expect(detectImageMime(bytes)).toBe(expected)
  })
})

describe("detectImageMime — zavrne izvršljivo/prevaro", () => {
  it("SVG (skriptabilen) ni prepoznan", () => {
    const svg = enc('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect(detectImageMime(svg)).toBeNull()
  })

  it("HTML preoblečen v sliko ni prepoznan", () => {
    expect(detectImageMime(enc("<!doctype html><html><body>x"))).toBeNull()
  })

  it("prekratka datoteka ni prepoznana (brez branja izven meja)", () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
    expect(detectImageMime(new Uint8Array(0))).toBeNull()
  })

  it("RIFF brez WEBP (npr. WAV) ni prepoznan kot slika", () => {
    expect(detectImageMime(pad([...enc("RIFF"), 0, 0, 0, 0, ...enc("WAVE")]))).toBeNull()
  })
})

describe("validateImageUpload — deklarirani tip se mora ujemati z vsebino", () => {
  it("whitelist vsebuje natanko rastrske formate (brez SVG)", () => {
    expect([...ALLOWED_IMAGE_MIME_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ])
    expect(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).not.toContain("image/svg+xml")
  })

  it("sprejme veljaven PNG", () => {
    const r = validateImageUpload("image/png", PNG)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mime).toBe("image/png")
  })

  it("zavrne image/svg+xml že na deklariranem tipu", () => {
    const r = validateImageUpload("image/svg+xml", enc("<svg/>"))
    expect(r).toEqual({ ok: false, error: "unsupported_type" })
  })

  it("zavrne druge ne-slikovne tipe", () => {
    for (const mime of ["application/pdf", "text/html", "application/octet-stream", ""]) {
      expect(validateImageUpload(mime, PNG)).toEqual({ ok: false, error: "unsupported_type" })
    }
  })

  it("zavrne ujemanje tipa brez ustreznih bajtov (PNG, ki je v resnici JPEG)", () => {
    expect(validateImageUpload("image/png", JPEG)).toEqual({
      ok: false,
      error: "content_mismatch",
    })
  })

  it("zavrne neprepoznano vsebino, tudi če je tip na whitelistu", () => {
    expect(validateImageUpload("image/png", enc("<svg/>"))).toEqual({
      ok: false,
      error: "content_mismatch",
    })
  })
})
