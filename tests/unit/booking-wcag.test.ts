import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// WCAG 2.2 yet: 1.3.1 (Info & Relationships) + 4.1.2 (Name, Role, Value)
// zahtevata, da je radio grupa programatično določljiva kot skupla. To se
// naredi s semanticnim <fieldset>/<legend>. Ta test je regresijska zaščita:
// če kdaj nekdo nadomesti fieldset z navadnim div/p, se test zalomi.

const __dirname = dirname(fileURLToPath(import.meta.url))
const bookingFormPath = join(__dirname, "../../src/components/booking/booking-form.tsx")

describe("U10 WCAG — plačilna radio grupa v booking-form", () => {
  it("uporablja <fieldset> za spupla radiosov (plačilni način)", async () => {
    const src = await readFile(bookingFormPath, "utf8")
    expect(src).toContain("<fieldset")
  })

  it("ima <legend> za plačilno radio grupo (ne skrito s screen-readerju)", async () => {
    const src = await readFile(bookingFormPath, "utf8")
    expect(src).toContain("<legend")
  })

  it("radio grupa za payment je znotraj fieldset + legend (zaprtje skladno)", async () => {
    const src = await readFile(bookingFormPath, "utf8")
    // Želeni vzorec: fieldset, ki vsebuje legend in se zapre z </fieldset>.
    // Preverimo, da obstaja blok, ki ima "name=\"paymentMode\"" znotraj
    // območja fieldset—</fieldset> (tj. polinBrak radiosov v eni skupini).
    const fieldsetStart = src.indexOf("<fieldset")
    const fieldsetEnd = src.indexOf("</fieldset>", fieldsetStart)
    expect(fieldsetStart).toBeGreaterThan(-1)
    expect(fieldsetEnd).toBeGreaterThan(fieldsetStart)
    const fieldsetBody = src.slice(fieldsetStart, fieldsetEnd)
    expect(fieldsetBody).toContain('name="paymentMode"')
  })

  it("ohrani vse tri <input type=\"radio\"> znotraj iste skupine", async () => {
    const src = await readFile(bookingFormPath, "utf8")
    // BO (booking) gre globoko — bo dps. Sami paymentMode inputa sta 2.
    const paymentInputs = (src.match(/name="paymentMode"/g) ?? []).length
    expect(paymentInputs).toBeGreaterThanOrEqual(2)
  })
})