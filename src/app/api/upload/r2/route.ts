import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { uploadBusinessImage, uploadProductImage, uploadAvatar } from "@/lib/r2-storage"
import { getSessionOrg } from "@/lib/tenant"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { validateImageUpload } from "@/lib/uploads/image-type"
import { rateLimit } from "@/lib/rate-limit"

// ============================================================
// R2 IMAGE UPLOAD API
// POST /api/upload/r2
// Uploads images to Cloudflare R2 storage.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nepooblaščen dostop" },
        { status: 401 }
      )
    }

    // M17: per-uporabniška kvota nalaganj (ključ = userId).
    const quota = await rateLimit({
      scope: "upload:user",
      key: session.user.id,
      limit: 100,
      windowMs: 3_600_000,
    })
    if (!quota.ok) {
      return NextResponse.json(
        { error: "Preveč nalaganj. Poskusite kasneje." },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string || "business"
    const entityId = formData.get("entityId") as string

    if (!file) {
      return NextResponse.json(
        { error: "Datoteka ni bila poslana" },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Datoteka je prevelika (max 10MB)" },
        { status: 400 }
      )
    }

    // Validate file type + magic bytes (P1: isti whitelist kot /api/upload;
    // Content-Type iz obrazca je samo trditev odjemalca).
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Nepodprt tip datoteke" },
        { status: 400 }
      )
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const check = validateImageUpload(file.type, bytes)
    if (!check.ok) {
      return NextResponse.json(
        { error: "Vsebina datoteke se ne ujema z njenim tipom." },
        { status: 415 }
      )
    }
    // Kopija v svež ArrayBuffer (TS tipi za BlobPart zahtevajo ArrayBuffer).
    const verified = new File([check.bytes.slice().buffer], file.name, {
      type: check.mime,
    })

    // P1 SECURITY (audit 2026-11): prej je bilo dovolj, da je bil uporabnik
    // prijavljen — `entityId` je bil poljuben, torej je vsak (tudi CLIENTE)
    // lahko pisal v imenski prostor TUJE organizacije
    // (`businesses/<tujOrgId>/…`), brez preverbe članstva in brez kvote.
    // Zdaj: organizacija pride IZ SEJE, `entityId` se preveri proti njej,
    // pisanje v tujo organizacijo pa zahteva pravico `settings.manage`.
    const sessionOrg = await getSessionOrg()
    const requestedOrgId = type === "avatar" ? null : (entityId || sessionOrg?.id || null)

    if (type !== "avatar") {
      if (!sessionOrg) {
        return NextResponse.json(
          { error: "Nimate poslovnega prostora za nalaganje." },
          { status: 403 }
        )
      }
      if (requestedOrgId !== sessionOrg.id) {
        return NextResponse.json(
          { error: "Nimate pravic za nalaganje v ta poslovni prostor." },
          { status: 403 }
        )
      }
      const perms = await getEffectivePermissions(session.user.id, sessionOrg.id)
      if (!perms.includes("settings.manage")) {
        return NextResponse.json(
          { error: "Nimate pravic za nalaganje slik." },
          { status: 403 }
        )
      }
    }

    let result
    switch (type) {
      case "avatar":
        result = await uploadAvatar(session.user.id, verified)
        break
      case "product": {
        // Nov izdelek še nima ID-ja → imenski prostor lastnika seje (kot
        // prej). Če je ID podan, mora izdelek pripadati ISTI organizaciji
        // (prej je bil poljuben → pisanje v tuj imenski prostor).
        if (!entityId) {
          result = await uploadProductImage(session.user.id, verified)
          break
        }
        const product = await prisma.product.findFirst({
          where: { id: entityId, organizationId: sessionOrg!.id },
          select: { id: true },
        })
        if (!product) {
          return NextResponse.json({ error: "Izdelek ne obstaja." }, { status: 404 })
        }
        result = await uploadProductImage(product.id, verified)
        break
      }
      case "business":
      default:
        result = await uploadBusinessImage(sessionOrg!.id, verified, "hero")
        break
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
    })
  } catch (error) {
    console.error("R2 upload error:", error)
    return NextResponse.json(
      { error: "Napaka pri nalaganju slike" },
      { status: 500 }
    )
  }
}