"use server"

// ============================================================
// REAL DATA EXPORT — every row comes from the organization's DB.
// No setTimeout, no fake "download", no invented record counts.
// ============================================================

import { requirePermissionOrg } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"

export type ExportDataType =
  | "appointments"
  | "customers"
  | "services"
  | "products"
  | "orders"
  | "revenue"

export type ExportFormat = "csv" | "json"

const MAX_ROWS = 5000

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n")
}

export async function exportBusinessData(
  dataType: ExportDataType,
  format: ExportFormat
): Promise<{
  success: boolean
  error?: string
  fileName?: string
  mimeType?: string
  content?: string
  recordCount?: number
}> {
  const { org } = await requirePermissionOrg("analytics.view")

  let headers: string[] = []
  let rows: unknown[][] = []

  try {
    switch (dataType) {
      case "appointments": {
        const data = await prisma.appointment.findMany({
          where: { organizationId: org.id },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            guestName: true,
            guestEmail: true,
            totalPrice: true,
            depositPaid: true,
          },
          orderBy: { startTime: "desc" },
          take: MAX_ROWS,
        })
        headers = ["id", "start", "end", "status", "guest", "email", "total", "deposit_paid"]
        rows = data.map((r) => [
          r.id,
          r.startTime,
          r.endTime,
          r.status,
          r.guestName,
          r.guestEmail,
          Number(r.totalPrice),
          r.depositPaid,
        ])
        break
      }
      case "customers": {
        const data = await prisma.customer.findMany({
          where: { organizationId: org.id, isArchived: false },
          select: { id: true, name: true, email: true, phone: true, tags: true, marketingConsent: true },
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
        })
        headers = ["id", "name", "email", "phone", "tags", "marketing_consent"]
        rows = data.map((r) => [r.id, r.name, r.email, r.phone, r.tags.join("|"), r.marketingConsent])
        break
      }
      case "services": {
        const data = await prisma.service.findMany({
          where: { organizationId: org.id },
          select: { id: true, name: true, slug: true, duration: true, price: true, isActive: true },
          orderBy: { name: "asc" },
          take: MAX_ROWS,
        })
        headers = ["id", "name", "slug", "duration_min", "price", "is_active"]
        rows = data.map((r) => [r.id, r.name, r.slug, r.duration, Number(r.price), r.isActive])
        break
      }
      case "products": {
        const data = await prisma.product.findMany({
          where: { organizationId: org.id },
          select: { id: true, name: true, sku: true, price: true, stockQuantity: true, forSale: true },
          orderBy: { name: "asc" },
          take: MAX_ROWS,
        })
        headers = ["id", "name", "sku", "price", "stock", "for_sale"]
        rows = data.map((r) => [
          r.id,
          r.name,
          r.sku,
          Number(r.price),
          r.stockQuantity,
          r.forSale,
        ])
        break
      }
      case "orders": {
        const data = await prisma.order.findMany({
          where: { organizationId: org.id },
          select: { id: true, createdAt: true, status: true, guestName: true, total: true },
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
        })
        headers = ["id", "created", "status", "guest", "total"]
        rows = data.map((r) => [r.id, r.createdAt, r.status, r.guestName, Number(r.total)])
        break
      }
      case "revenue": {
        const [appointments, orders] = await Promise.all([
          prisma.appointment.findMany({
            where: { organizationId: org.id, status: "COMPLETED" },
            select: { id: true, startTime: true, totalPrice: true },
            orderBy: { startTime: "desc" },
            take: MAX_ROWS,
          }),
          prisma.order.findMany({
            where: { organizationId: org.id, status: "COMPLETED" },
            select: { id: true, createdAt: true, total: true },
            orderBy: { createdAt: "desc" },
            take: MAX_ROWS,
          }),
        ])
        headers = ["source", "id", "date", "amount"]
        rows = [
          ...appointments.map((r) => ["appointment", r.id, r.startTime, Number(r.totalPrice)]),
          ...orders.map((r) => ["order", r.id, r.createdAt, Number(r.total)]),
        ].slice(0, MAX_ROWS)
        break
      }
    }
  } catch (error) {
    console.error("exportBusinessData failed:", error)
    return { success: false, error: "Izvoz podatkov ni uspel. Poskusite znova." }
  }

  const isJson = format === "json"
  const content = isJson
    ? JSON.stringify(rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]]))), null, 2)
    : toCsv(headers, rows)
  const extension = isJson ? "json" : "csv"
  const date = new Date().toISOString().slice(0, 10)

  return {
    success: true,
    fileName: `${org.slug}-${dataType}-${date}.${extension}`,
    mimeType: isJson ? "application/json" : "text/csv;charset=utf-8",
    content,
    recordCount: rows.length,
  }
}
