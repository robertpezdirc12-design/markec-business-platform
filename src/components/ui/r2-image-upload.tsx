"use client"

// ============================================================
// R2 IMAGE UPLOAD COMPONENT
// Professional drag & drop upload with preview, progress, and
// validation. Uses Cloudflare R2 storage.
// ============================================================

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { UploadIcon, CloseIcon, ImageIcon } from "@/components/icons"
import { uploadImageToR2, prepareImageForUpload } from "@/lib/r2-upload-client"
import { cn } from "@/lib/utils"

interface R2ImageUploadProps {
  /** Current image URL (for preview) */
  value?: string
  /** Callback when upload completes */
  onUpload: (url: string) => void
  /** Upload type */
  type: "business" | "product" | "avatar" | "service" | "staff" | "branding"
  /** Entity ID (optional) */
  entityId?: string
  /** Label */
  label?: string
  /** Accept types */
  accept?: string
  /** Max file size in MB */
  maxSizeMB?: number
  /** Disabled state */
  disabled?: boolean
  /** CSS class */
  className?: string
  /** Aspect ratio for preview */
  aspectRatio?: "square" | "video" | "wide" | "auto"
}

export function R2ImageUpload({
  value,
  onUpload,
  type,
  entityId,
  label = "Naloži sliko",
  accept = "image/*",
  maxSizeMB = 10,
  disabled = false,
  className,
  aspectRatio = "auto",
}: R2ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`Slika je prevelika (max ${maxSizeMB}MB)`)
        return
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Dovoljene so samo slike")
        return
      }

      try {
        setUploading(true)

        // Create preview
        const objectUrl = URL.createObjectURL(file)
        setPreview(objectUrl)

        // Upload to R2
        const url = await uploadImageToR2(file, type, entityId)

        // Cleanup preview URL
        URL.revokeObjectURL(objectUrl)

        // Set final URL
        setPreview(url)
        onUpload(url)
        toast.success("Slika je bila naložena")
      } catch (error) {
        console.error("Upload error:", error)
        toast.error(
          error instanceof Error ? error.message : "Nalaganje ni uspelo"
        )
        // Reset preview on error
        setPreview(value || null)
      } finally {
        setUploading(false)
      }
    },
    [type, entityId, maxSizeMB, onUpload, value]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleRemove = useCallback(() => {
    setPreview(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }, [])

  const aspectClass = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
    auto: "",
  }[aspectRatio]

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Preview or Dropzone */}
      {preview ? (
        <div className={cn("relative overflow-hidden rounded-lg border", aspectClass)}>
          {/* <img> (ne next/image): predogled lahko vsebuje blob:/object URL
              (URL.createObjectURL), ki ga next/image ne podpira. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity hover:opacity-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
            >
              <UploadIcon size={16} className="mr-1" />
              Zamenjaj
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              <CloseIcon size={16} className="mr-1" />
              Odstrani
            </Button>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
            aspectClass,
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-2 rounded-full bg-muted p-2">
              <ImageIcon size={24} className="text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium">
              {dragOver ? "Spusti sliko tukaj" : "Povleci sliko tukaj"}
            </p>
            <p className="text-xs text-muted-foreground">
              ali{" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || uploading}
              >
                izberi datoteko
              </button>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PNG, JPG, WEBP do {maxSizeMB}MB
            </p>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Nalaganje...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled || uploading}
        className="hidden"
      />
    </div>
  )
}

/**
 * Simple avatar upload component
 */
export function R2AvatarUpload({
  value,
  onUpload,
  disabled,
  size = "md",
}: {
  value?: string
  onUpload: (url: string) => void
  disabled?: boolean
  size?: "sm" | "md" | "lg"
}) {
  const sizeClass = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  }[size]

  return (
    <R2ImageUpload
      value={value}
      onUpload={onUpload}
      type="avatar"
      aspectRatio="square"
      disabled={disabled}
      className={cn("mx-auto", sizeClass)}
    />
  )
}