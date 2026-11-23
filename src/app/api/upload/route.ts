import { NextRequest, NextResponse } from "next/server"
import { validateImageUpload, ALLOWED_IMAGE_MIME_TYPES } from "@/lib/uploads/image-type"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { v2 as cloudinary } from "cloudinary"
import { getSessionOrg } from "@/lib/tenant"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getPlan } from "@/lib/plans/registry"
import { checkStorageLimit } from "@/lib/plans/types"
import { getOrgStorageBytes } from "@/lib/plans/resolve"
import { rateLimit } from "@/lib/rate-limit"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const cloudinaryConfigured =
  !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET

// Upload type configurations
type UploadType =
  | "avatar"
  | "service"
  | "product"
  | "staff"
  | "logo"
  | "hero"
  | "about"
  | "cta"
  // #101 no-code: slike lastnih sekcij (isti varnostni pogoji kot branding)
  | "content"
  // Fotografije delovnih naročil (stopnje izdelave) — /dashboard/work-orders
  | "workorder"

const uploadConfigs: Record<UploadType, { folder: string }> = {
  avatar: { folder: "avatars" },
  service: { folder: "services" },
  product: { folder: "products" },
  staff: { folder: "staff" },
  logo: { folder: "branding" },
  hero: { folder: "branding" },
  about: { folder: "branding" },
  cta: { folder: "branding" },
  content: { folder: "branding" },
  workorder: { folder: "work-orders" },
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // M17 (audit 2026-11): per-uporabniška kvota nalaganj (ključ = userId) —
    // omeji zlorabo shrambe s strani enega računa (tudi CLIENTE).
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
    const file = formData.get("file") as File | null
    const type = (formData.get("type") as UploadType) || "avatar"
    const customId = formData.get("customId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate upload type
    if (!(type in uploadConfigs)) {
      return NextResponse.json({ error: "Invalid upload type" }, { status: 400 })
    }

    // SECURITY: only ADMIN/STAFF may upload site content; regular users are
    // limited to their own avatar uploads.
    if (type !== "avatar" && !["ADMIN", "STAFF"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to upload this content type" },
        { status: 403 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // P1 SECURITY (audit 2026-11): prej je bilo dovolj `image/*`, torej tudi
    // `image/svg+xml` — shranjeni XSS (SVG s <script>, serviran z izvora
    // aplikacije; avatar lahko naloži vsak prijavljen uporabnik). Zdaj velja
    // whitelist rastrskih formatov + preverjanje MAGIC BYTES: deklarirani
    // Content-Type je samo trditev odjemalca.
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: "Dovoljene so slike JPEG, PNG, WebP, GIF ali AVIF." },
        { status: 415 }
      )
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const imageCheck = validateImageUpload(file.type, fileBytes)
    if (!imageCheck.ok) {
      return NextResponse.json(
        {
          error:
            imageCheck.error === "unsupported_type"
              ? "Dovoljene so slike JPEG, PNG, WebP, GIF ali AVIF."
              : "Vsebina datoteke se ne ujema z njenim tipom.",
        },
        { status: 415 }
      )
    }

    const config = uploadConfigs[type]

    // Org context: admins/staff upload into THEIR salon's namespace
    const org =
      session.user.role === "CLIENTE"
        ? null
        : await getSessionOrg()

    // --- Path A: Cloudinary (if the salon configured it) ---
    if (cloudinaryConfigured) {
      const buffer = Buffer.from(fileBytes)
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`

      // SECURITY: public_id is always server-generated. Client-supplied ids
      // would let an attacker overwrite existing site imagery, so they are ignored.
      const safePrefix = type.replace(/[^a-z_]/g, "")
      const publicId = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      void customId

      // Točka 4 (samodejno rezanje velikosti): vsaka naložena slika se ob
      // uploadu omeji na največ 2000px širine in samodejno optimizira zapis
      // (kvaliteta + format). Cloudinary `crop: limit` nikoli NE poveča
      // manjše slike; rezultat je manjša datoteka za download, hero, about,
      // cta in custom sekcije — brez spremembe kode na mestu prikazovanja.
      const result = await cloudinary.uploader.upload(base64, {
        folder: org ? `${org.slug}/${config.folder}` : `Beauty Salon/${config.folder}`,
        public_id: publicId,
        overwrite: false,
        transformation: [
          { width: 2000, crop: "limit", quality: "auto", fetch_format: "auto" },
        ],
      })

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      })
    }

    // --- Path B: DB-backed media storage (zero third-party keys needed) ---
    const base64 = Buffer.from(fileBytes).toString("base64")

    // STORAGE QUOTA (E3-7): the plan's storageMb limit is enforced
    // server-side on this DB-backed path before the row is written.
    // Would-be usage = current org-scoped bytes + the incoming file;
    // existing media is never removed when over quota (uploads stop).
    // Tenant-less uploads (CLIENTE avatars) are platform storage, not
    // tenant quota. Cloudinary (Path A) is metered externally.
    if (org) {
      const [currentBytes, locale] = await Promise.all([
        getOrgStorageBytes(org.id),
        getLocaleFromCookies(),
      ])
      const gate = checkStorageLimit(getPlan(org.plan), currentBytes + file.size)
      if (!gate.ok) {
        return NextResponse.json(
          { error: locale === "en" ? gate.messageEn : gate.message },
          { status: 429 }
        )
      }
    }

    const media = await prisma.media.create({
      data: {
        organizationId: org?.id ?? null,
        filename: file.name.slice(0, 200) || "upload",
        mimeType: file.type,
        size: file.size,
        data: base64,
      },
    })

    return NextResponse.json({
      success: true,
      url: `/api/media/${media.id}`,
      publicId: media.id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
