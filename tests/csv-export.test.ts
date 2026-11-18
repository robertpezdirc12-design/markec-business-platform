import { describe, it, expect } from "vitest"
import { csvCell, toCsv } from "../src/lib/utils/csv"

describe("csvCell", () => {
  it("quotes and escapes RFC 4180 special characters", () => {
    expect(csvCell('Ana "Ančka" Novak')).toBe('"Ana ""Ančka"" Novak"')
    expect(csvCell("Novak, Ana")).toBe('"Novak, Ana"')
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"')
  })

  it("neutralises formula injection from customer-supplied values", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"'
    )
    expect(csvCell("+386 40 123 456")).toBe('"\'+386 40 123 456"')
    expect(csvCell("@SUM(A1:A2)")).toBe('"\'@SUM(A1:A2)"')
    expect(csvCell("-2+3")).toBe('"\'-2+3"')
  })

  it("keeps negative numbers as numbers", () => {
    expect(csvCell(-5)).toBe('"-5"')
    expect(csvCell("-5.25")).toBe('"-5.25"')
  })

  it("renders null/undefined as an empty cell", () => {
    expect(csvCell(null)).toBe("")
    expect(csvCell(undefined)).toBe("")
  })
})

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, 2], ["x,y", 'q"z']])).toBe(
      '"a","b"\r\n"1","2"\r\n"x,y","q""z"'
    )
  })
})
