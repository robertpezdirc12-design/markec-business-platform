// ============================================================
// Nepovratna dejanja morajo imeti vmesni korak.
//
// 1) "Ni se pojavil" pošlje stranki obvestilo in vpliva na
//    statistiko — en sam klik je premalo (WCAG 3.3.4 Error
//    Prevention, enaka logika kot pri plačljivi rezervaciji).
// 2) Kartica Google Calendar na /dashboard/settings je RESNIČNA
//    (OAuth + šifrirani žetoni + izvoz). Test zato brani dvoje:
//    da se ne vrne lažno "simulirano" stanje in da odklop ostane
//    za potrditvijo.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

const appointmentDialog = read(
  "src/components/staff/appointment-details-dialog.tsx"
)
const googleSync = read("src/components/dashboard/google-calendar-sync.tsx")

describe("no-show zahteva potrditev", () => {
  it("ima stanje potrditve", () => {
    expect(appointmentDialog).toContain("const [confirmNoShow, setConfirmNoShow] = useState(false)")
  })

  it("gumb najprej odpre potrditev, ne kliče akcije", () => {
    expect(appointmentDialog).toContain("onClick={() => setConfirmNoShow(true)}")
  })

  it("akcija se izvede šele v potrditvenem bloku z role=alert", () => {
    const alert = appointmentDialog.indexOf('role="alert"')
    const call = appointmentDialog.indexOf("onMarkNoShow?.(appointment.id)")
    expect(alert).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(alert)
  })

  it("potrditev ima tudi preklic", () => {
    expect(appointmentDialog).toContain("Prekliči")
  })
})

describe("Google Calendar kartica je resnična, ne simulirana", () => {
  it("ne simulira več povezave s časovnikom", () => {
    expect(googleSync).not.toContain("setTimeout")
    expect(googleSync).not.toContain('toast.success("Google Calendar povezan!")')
    expect(googleSync).not.toContain("Sinhronizacija uspešna! 5 terminov posodobljenih.")
    expect(googleSync).not.toContain("Predogled:")
  })

  it("gumb vodi na pravo OAuth pot, akcije pa so strežniške", () => {
    expect(googleSync).toContain('href="/api/integrations/google/calendar/connect"')
    expect(googleSync).toContain("syncCalendar")
    expect(googleSync).toContain("disconnectCalendar")
  })

  it("odklop zahteva potrditev (žetoni se izbrišejo)", () => {
    const confirm = googleSync.indexOf("confirmDisconnect")
    const action = googleSync.indexOf("disconnectCalendar()")
    expect(confirm).toBeGreaterThan(-1)
    expect(action).toBeGreaterThan(confirm)
    expect(googleSync).toContain("ConfirmDialog")
  })

  it("brez strežniških poverilnic pove 'Ni nastavljeno', ne ponuja gumba", () => {
    expect(googleSync).toContain("Ni nastavljeno")
    expect(googleSync).toContain("GOOGLE_CALENDAR_CLIENT_ID")
  })
})

const projectDetail = read("src/components/admin/projects/project-detail-client.tsx")
const projectsDict = read("src/lib/i18n/dict/projects.ts")

describe("brisanje projektne naloge zahteva potrditev", () => {
  it("gumb odpre potrditev namesto takojšnjega brisanja", () => {
    expect(projectDetail).toContain("setTaskToDelete({ id: task.id, title: task.title })")
    expect(projectDetail).not.toContain("onClick={() => removeTask(task.id)}")
  })

  it("potrditev navaja, kaj bo izbrisano (SL + EN)", () => {
    expect(projectDetail).toContain("labels.deleteTaskConfirm(taskToDelete.title)")
    expect(projectsDict).toContain("deleteTaskConfirm: (title: string) =>")
    expect(projectsDict).toContain("bo trajno izbrisana")
    expect(projectsDict).toContain("will be permanently deleted")
  })
})
