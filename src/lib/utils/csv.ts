/**
 * CSV helpers — safe for client and server.
 *
 * Two problems are solved here:
 *  1. **Escaping**: a customer name containing `"`, `,` or a newline must not
 *     shift columns or corrupt the file. Every cell is quoted and inner quotes
 *     are doubled (RFC 4180).
 *  2. **Formula injection**: customer-supplied values such as
 *     `=HYPERLINK("http://evil")` execute when the owner opens the export in
 *     Excel/Sheets. A leading `'` neutralises the formula. Pure negative
 *     numbers (`-5`) are left alone so numeric columns still work.
 */

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)
  // OWASP CSV injection: neutralise formula-leading characters.
  if (/^[=+@\t\r]|^-(?!\d+(?:\.\d+)?$)/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n")
}
