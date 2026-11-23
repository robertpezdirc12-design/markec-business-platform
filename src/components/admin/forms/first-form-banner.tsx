"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createFormDefinition } from "@/app/actions/forms"
import { WarningCircleIcon, SpinnerIcon } from "@/components/icons"

// ============================================================
// FIRST FORM BANNER — odprava mrtve točke za profile z
// forms: required a forms: [] (12 profilov, npr. skd-l-finance,
// skd-r-health). Modul forms je ACTIVE (jedro dejavnosti), a
// definicij ni — in lastnik doslej NI imel UI vstopne točke za
// prvi obrazec (ni bilo createFormDefinition; doc F5-5-ARHITEKTURA
// to potrjuje kot znano luknjo).
//
// Gumb ustvari LASTNISKI OSNUTEK (sourceProfile: null, isActive:
// false, 0 polj) ki ga lastnik nato dopolni s SVOJIMI polji v
// obstoječem urejevalniku in šele nato aktivira. NIZA fiktivnih
// polj (ne fabrikacija po §3).
// ============================================================

export interface FirstFormBannerProps {
  title: string
  description: string
  cta: string
  creating: string
  created: string
  alreadyExists: string
  genericError: string
  namePlaceholder: string
}

export function FirstFormBanner({
  title,
  description,
  cta,
  creating,
  created,
  alreadyExists,
  genericError,
  namePlaceholder,
}: FirstFormBannerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [customName, setCustomName] = useState("")

  function handleCreate() {
    const name = customName.trim() || "Povpraševanje"
    startTransition(async () => {
      const res = await createFormDefinition({ name })
      if (res.ok) {
        toast.success(created)
        setDone(true)
        router.refresh()
      } else if (res.error === "EXISTS") {
        toast.info(alreadyExists)
        setDone(true)
        router.refresh()
      } else {
        toast.error(genericError)
      }
    })
  }

  if (done) return null

  return (
    <div className="ring-amber-500/40 bg-amber-500/5 flex flex-col gap-3 rounded-lg p-4 ring-1 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3 sm:flex-1">
        <WarningCircleIcon size={20} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-tight">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:w-72">
        <Label htmlFor="newform-name" className="sr-only">
          {namePlaceholder}
        </Label>
        <Input
          id="newform-name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={namePlaceholder}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate()
          }}
        />
        <Button variant="outline" size="sm" disabled={pending} onClick={handleCreate} className="shrink-0">
          {pending && <SpinnerIcon size={14} className="animate-spin" />}
          {pending ? creating : cta}
        </Button>
      </div>
    </div>
  )
}