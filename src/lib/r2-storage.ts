// ============================================================
// CLOUDFLARE R2 STORAGE (S3-compatible)
// Image upload/management for MARKEC marketplace.
// Replaces Cloudinary for cost-effective image storage.
// ============================================================

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_BUCKET = process.env.R2_BUCKET || "markec-images"
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

// S3 Client for R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
})

export interface UploadResult {
  key: string
  url: string
  size: number
}

/**
 * P1 (audit 2026-11) — varna končnica iz imena datoteke.
 *
 * Prej: `file.name.split(".").pop()` — kar koli je bilo za zadnjo piko, je
 * šlo v R2 ključ (npr. `hero.png/../../x` ali `hero.svg`). Končnica mora
 * izhajati iz PREVERJENEGA MIME tipa, nikoli iz imena, ki ga nadzoruje
 * odjemalec.
 */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
}

export function safeImageExtension(contentType: string): string {
  return MIME_TO_EXT[contentType] ?? "bin"
}

/**
 * Upload image to R2
 */
export async function uploadImage(
  file: File | Buffer,
  key: string,
  contentType: string = "image/jpeg"
): Promise<UploadResult> {
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000", // 1 year cache
  })

  await r2Client.send(command)

  const url = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

  return {
    key,
    url,
    size: buffer.length,
  }
}

/**
 * Upload business image
 */
export async function uploadBusinessImage(
  businessId: string,
  file: File,
  type: "logo" | "hero" | "gallery" = "hero"
): Promise<UploadResult> {
  const ext = safeImageExtension(file.type)
  const key = `businesses/${businessId}/${type}-${Date.now()}.${ext}`
  return uploadImage(file, key, file.type)
}

/**
 * Upload product image
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<UploadResult> {
  const ext = safeImageExtension(file.type)
  const key = `products/${productId}/${Date.now()}.${ext}`
  return uploadImage(file, key, file.type)
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<UploadResult> {
  const ext = safeImageExtension(file.type)
  const key = `avatars/${userId}/${Date.now()}.${ext}`
  return uploadImage(file, key, file.type)
}

/**
 * Delete image from R2
 */
export async function deleteImage(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })

  await r2Client.send(command)
}

/**
 * Get public URL for image key
 */
export function getImageUrl(key: string): string {
  return R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`
}

/**
 * Generate presigned URL for direct upload
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}