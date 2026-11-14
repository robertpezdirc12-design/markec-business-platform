"use client"

// ============================================================
// GDPR — izvoz in izbris podatkov (moj račun)
//  • "Prenesi moje podatke" → JSON izvoz (pravica do prenosljivosti)
//  • "Izbriši račun" → zahteva geslo, anonimizira osebne podatke in
//    izbriše prijavni račun (pravica do pozabe); poslovne evidence
//    ostanejo zaradi davčnih predpisov.
// ============================================================

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpinnerGapIcon } from "@/components/icons"
import { toast } from "sonner"
import { exportMyData, deleteMyAccount } from "@/app/actions/account"

export function GdprSection() {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [showDelete, setShowDelete] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportMyData()
      if ("success" in data && data.success === false) {
        toast.error(data.error ?? "Izvoza ni bilo mogoče pripraviti.")
        return
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "moji-podatki.json"
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success("Prenos podatkov je pripravljen.")
    } catch {
      toast.error("Izvoza ni bilo mogoče pripraviti.")
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (confirmText.trim().toLowerCase() !== "izbrisi") {
      toast.error("Za potrditev vtipkajte »izbrisi«.")
      return
    }
    setDeleting(true)
    const res = await deleteMyAccount(password)
    setDeleting(false)
    if (!res.success) {
      toast.error(res.error ?? "Brisanja ni bilo mogoče dokončati.")
      return
    }
    toast.success("Račun izbrisan.")
    await signOut({ redirect: false })
    router.push("/")
    router.refresh()
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-foreground text-lg font-semibold">Moji podatki (GDPR)</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Pravica do prenosa in pozabe. Poslovne evidence (naročila, termini, računi)
        ob izbrisu anonimiziramo — podatkov zato ne moremo kar tako izbrisati v celoti.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting && <SpinnerGapIcon size={15} className="mr-2 animate-spin" />}
          Prenesi moje podatke (.json)
        </Button>
        <Button variant="outline" onClick={() => setShowDelete((s) => !s)}>
          Izbriši račun
        </Button>
      </div>

      {showDelete && (
        <div className="border-destructive/30 mt-4 space-y-3 rounded-lg border p-4">
          <p className="text-destructive text-sm">Trajno dejanje — tega ni mogoče razveljaviti.</p>
          <div className="space-y-1.5">
            <Label htmlFor="gdpr-password">Geslo</Label>
            <Input
              id="gdpr-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Vaše geslo"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gdpr-confirm">Vtipkajte »izbrisi«</Label>
            <Input
              id="gdpr-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Brišem …" : "Trajno izbriši račun"}
          </Button>
        </div>
      )}
    </div>
  )
}