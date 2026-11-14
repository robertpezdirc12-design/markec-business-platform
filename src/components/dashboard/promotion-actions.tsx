"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import { deletePromotion, setPromotionStatus } from "@/app/actions/promotions"

interface PromotionActionsProps {
  id: string
  status: "DRAFT" | "ACTIVE" | "INACTIVE"
}

export function PromotionActions({ id, status }: PromotionActionsProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState<"activate" | "deactivate" | "delete" | null>(null)

  const run = async (
    kind: "activate" | "deactivate" | "delete",
    fn: () => Promise<{ success: boolean; error?: string }>
  ) => {
    setBusy(kind)
    try {
      const res = await fn()
      if (!res.success) {
        toast.error(res.error ?? "Napaka.")
        return
      }
      toast.success(
        kind === "delete" ? t.promotions.deleted : t.promotions.statusUpdated
      )
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ACTIVE" && (
        <Button
          size="sm"
          variant="default"
          disabled={busy !== null}
          onClick={() =>
            run("activate", () => setPromotionStatus(id, "ACTIVE"))
          }
        >
          {t.promotions.activate}
        </Button>
      )}
      {status === "ACTIVE" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            run("deactivate", () => setPromotionStatus(id, "INACTIVE"))
          }
        >
          {t.promotions.deactivate}
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        disabled={busy !== null}
        onClick={() => {
          if (confirm(t.promotions.deleteConfirm)) {
            run("delete", () => deletePromotion(id))
          }
        }}
      >
        {t.promotions.delete}
      </Button>
    </div>
  )
}