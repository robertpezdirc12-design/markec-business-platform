import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { uploadBusinessImage, uploadProductImage, uploadAvatar } from "@/lib/r2-storage"

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

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Nepodprt tip datoteke" },
        { status: 400 }
      )
    }

    let result
    switch (type) {
      case "avatar":
        result = await uploadAvatar(session.user.id, file)
        break
      case "product":
        result = await uploadProductImage(entityId || session.user.id, file)
        break
      case "business":
      default:
        result = await uploadBusinessImage(entityId || session.user.id, file, "hero")
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