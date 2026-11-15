// Konfiguracijske opcije za porabo materiala (work-orders) — IZVEN "use server"
// modulov. Next.js `"use server"` in Next Build ne dovolijo izvoženih objektov
// (const/objekt) iz Server Action modulov (napaka "a \"use server\" file can
// only export async functions"). Ti konfiguracijski objekti se zato nahajajo
// tu, v čistem modulu brez dinate, in jih importirajo tudi action moduli.
import type { ConsumptionOptions } from "@/app/actions/work-order-consumption"

/** Opcije za šiviljstvo — uporabi customerId, dokument = QUOTE (osnutek ponudbe). */
export const SEAMSTRESS_CONSUMPTION_OPTS: ConsumptionOptions = {
  useWorkOrderCustomer: true,
  documentType: "QUOTE",
  documentStatus: "DRAFT",
  orderNotes: "Poraba materiala na delovnem nalogu (šiviljstvo)",
  documentNotes: "Šiviljstvo — poraba materiala (sledljivost).",
  eventMessage: (totalQty, orderShortId, docNumber) =>
    `Poraba materiala: ${totalQty} kos → naročilo ${orderShortId} / dokument ${docNumber}`,
  revalidatePaths: ["/dashboard/seamstress", "/dashboard/work-orders"],
}

/** Opcije za servis vozil — brez customerId na Order, dokument = QUOTE. */
export const VEHICLE_WORKSHOP_CONSUMPTION_OPTS: ConsumptionOptions = {
  useWorkOrderCustomer: false,
  documentType: "QUOTE",
  documentStatus: "DRAFT",
  orderNotes: "Poraba delov na delovnem nalogu",
  documentNotes: "Delovni nalog — poraba delov (sledljivost).",
  eventMessage: (totalQty, orderShortId, docNumber) =>
    `Poraba delov: ${totalQty} kos → naročilo ${orderShortId} / dokument ${docNumber}`,
  revalidatePaths: ["/dashboard/tire-service", "/dashboard/work-orders"],
}