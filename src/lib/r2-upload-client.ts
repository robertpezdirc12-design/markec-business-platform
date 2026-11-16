"use client"

/**
 * R2 Upload Client — Cloudflare R2 storage
 * Client-side image upload za R2 storage.
 */

/**
 * Prepare image for upload (downscale + re-encode)
 */
export async function prepareImageForUpload(
  file: File,
  maxDimension = 1400,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1 && file.size < 1.2 * 1024 * 1024) return file

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg" })
  } catch {
    return file
  }
}

/**
 * Upload image to R2 storage
 * Returns the public URL of the uploaded image
 */
export async function uploadImageToR2(
  file: File,
  type: "business" | "product" | "avatar" | "service" | "staff" | "branding",
  entityId?: string
): Promise<string> {
  const prepared = await prepareImageForUpload(file)
  const formData = new FormData()
  formData.append("file", prepared)
  formData.append("type", type)
  if (entityId) {
    formData.append("entityId", entityId)
  }

  const res = await fetch("/api/upload/r2", {
    method: "POST",
    body: formData,
  })

  const json = await res.json()
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || "Upload ni uspel")
  }
  return json.url as string
}

/**
 * Upload business image (logo, hero, etc.)
 */
export async function uploadBusinessImageToR2(
  file: File,
  entityId: string
): Promise<string> {
  return uploadImageToR2(file, "business", entityId)
}

/**
 * Upload product image
 */
export async function uploadProductImageToR2(
  file: File,
  entityId: string
): Promise<string> {
  return uploadImageToR2(file, "product", entityId)
}

/**
 * Upload avatar image
 */
export async function uploadAvatarToR2(
  file: File
): Promise<string> {
  return uploadImageToR2(file, "avatar")
}

/**
 * Upload service image
 */
export async function uploadServiceImageToR2(
  file: File,
  entityId: string
): Promise<string> {
  return uploadImageToR2(file, "service", entityId)
}

/**
 * Upload staff image
 */
export async function uploadStaffImageToR2(
  file: File,
  entityId: string
): Promise<string> {
  return uploadImageToR2(file, "staff", entityId)
}

/**
 * Upload branding image (logo, hero, about, cta)
 */
export async function uploadBrandingImageToR2(
  file: File,
  entityId: string
): Promise<string> {
  return uploadImageToR2(file, "branding", entityId)
}

/**
 * Drag & Drop upload component props
 */
export interface R2UploadDropzoneProps {
  onUpload: (url: string) => void
  onError?: (error: string) => void
  type: "business" | "product" | "avatar" | "service" | "staff" | "branding"
  entityId?: string
  accept?: string
  maxSize?: number
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

/**
 * Get presigned upload URL for direct client upload
 */
export async function getPresignedUploadUrl(
  fileName: string,
  contentType: string,
  type: string
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const res = await fetch("/api/upload/r2", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType, type }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error || "Ni uspelo dobiti presigned URL")
  }
  return json
}

/**
 * Upload directly to R2 using presigned URL (for large files)
 */
export async function uploadDirectToR2(
  file: File,
  type: string
): Promise<string> {
  // Get presigned URL
  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
    file.name,
    file.type,
    type
  )

  // Upload directly to R2
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  })

  if (!res.ok) {
    throw new Error("Upload ni uspel")
  }

  return publicUrl
}