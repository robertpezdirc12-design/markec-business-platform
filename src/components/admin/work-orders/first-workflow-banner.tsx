"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createFirstWorkflowDefinition } from "@/app/actions/work-orders"
import { WarningCircleIcon, SpinnerIcon } from "@/components/icons"

// ============================================================
// FIRST WORKFLOW BANNER — odprava mrtve točke za profile, ki
// imajo workOrders: required, a nobene predloge (beekeeping,
// skd-a-agriculture, skd-b-mining, skd-c-manufacturing, skd-d-energy,
// skd-e-water-waste, skd-h-transport). Brez procesa bi createWorkOrder
// vedno vrnil NO_WORKFLOW, doslej pa tudi ni bilo UI vstopne točke,
// da bi lastnik ustvaril prvega.
//
// Gumb ustvari NEVTRALEN, lastnik-posedovan proces (sourceProfile:
// null) z eno strukturno stopnjo, ki jo lastnik nato uredi/
// preimenuje po svoji panogi z obstoječim ProcessEditorDialog.
// NIZA sector-predloga, zato ni fabrikacija po §3.
// ============================================================

export interface FirstWorkflowBannerProps {
  title: string
  description: string
  cta: string
  creating: string
  created: string
  alreadyExists: string
  genericError: string
}

export function FirstWorkflowBanner({
  title,
  description,
  cta,
  creating,
  created,
  alreadyExists,
  genericError,
}: FirstWorkflowBannerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleCreate() {
    startTransition(async () => {
      const res = await createFirstWorkflowDefinition()
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
    <div className="ring-amber-500/40 bg-amber-500/5 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4 ring-1">
      <div className="flex items-start gap-3">
        <WarningCircleIcon size={20} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium leading-tight">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-tight">{description}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={handleCreate}
        className="shrink-0"
      >
        {pending && <SpinnerIcon size={14} className="animate-spin" />}
        {pending ? creating : cta}
      </Button>
    </div>
  )
}