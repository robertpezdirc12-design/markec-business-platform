import { toast as sonnerToast } from "sonner"

type ToastVariant = "default" | "destructive"

export interface ToastProps {
  title?: string
  description?: string
  variant?: ToastVariant
}

function toast({ title, description, variant }: ToastProps) {
  const message = title ?? description ?? ""
  const options = title && description ? { description } : undefined

  if (variant === "destructive") {
    sonnerToast.error(message || "Napaka", options)
    return
  }

  sonnerToast(message || "OK", options)
}

export function useToast() {
  return { toast }
}

export { toast }
