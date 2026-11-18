"use client"

// ============================================================
// 2D-1W — delavnica vozil na podrobnostih rezervacije: prikaže vozila
// (povezana s stranko/rezervacijo), omogoči izrecno akcijo
// 'Ustvari delovni nalog iz rezervacije' in požene obvestilo/redirekcijo.
// ============================================================

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SpinnerGapIcon } from "@/components/icons"
import {
  createWorkOrderFromAppointment,
  type AppointmentWorkshopInfo,
} from "@/app/actions/workshop-booking"

interface Props {
  info: AppointmentWorkshopInfo
  appointmentId: string
}

export function WorkshopWorkOrderCard({ info, appointmentId }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (!info.enabled) return null

  const handleCreate = () => {
    start(async () => {
      const res = await createWorkOrderFromAppointment({ appointmentId })
      if (res.ok && res.workOrderId) {
        toast.success("Delovni nalog je ustvarjen iz rezervacije.")
        router.refresh()
      } else {
        toast.error(
          res.error === "ALREADY_CREATED"
            ? "Delovni nalog za to rezervacijo že obstaja."
            : res.error === "NOT_CONFIRMED"
              ? "Termin mora biti potrjen, preden lahko ustvarite delovni nalog."
              : res.error === "NO_VEHICLE"
                ? "Rezervaciji najprej povežite vozilo."
                : "Ustvarjanje delovnega naloga ni uspelo."
        )
        if (res.error === "ALREADY_CREATED") router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Delavnica vozil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {info.vehicles.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Za to rezervacijo še ni povezanega vozila.
          </p>
        )}

        {info.vehicles.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{v.title}</p>
              <p className="text-muted-foreground text-sm">
                {v.licensePlate || "— registrska oznaka"}
              </p>
            </div>
            {v.linkedWorkOrderId ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/work-orders/${v.linkedWorkOrderId}`}>
                  Delovni nalog
                </Link>
              </Button>
            ) : null}
          </div>
        ))}

        {info.createdWorkOrder ? (
          <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="font-medium">Delovni nalog ustvarjen</p>
              <p className="text-sm text-muted-foreground">
                #{info.createdWorkOrder.number} — {info.createdWorkOrder.title}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/work-orders/${info.createdWorkOrder.id}`}>
                Odpri nalog
              </Link>
            </Button>
          </div>
        ) : (
          <Button
            disabled={!info.canCreateWorkOrder || pending}
            onClick={handleCreate}
            className="w-full"
          >
            {pending ? <SpinnerGapIcon size={16} className="mr-2 animate-spin" /> : null}
            Ustvari delovni nalog iz rezervacije
          </Button>
        )}

        {info.createDisabledReason && !info.createdWorkOrder && (
          <p className="text-muted-foreground text-xs">
            {info.createDisabledReason === "STATUS_NOT_CONFIRMED" &&
              "Nalog je mogoče ustvariti šele po potrditvi termina."}
            {info.createDisabledReason === "NO_VEHICLE" &&
              "Rezervaciji dodajte vozilo (vnesite ga pri oddaji ali ga povežite s stranko)."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}