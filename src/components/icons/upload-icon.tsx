import { UploadSimple } from "@phosphor-icons/react/dist/ssr"

interface UploadIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function UploadIcon({ size = 20, weight = "regular", className = "" }: UploadIconProps) {
  return <UploadSimple size={size} weight={weight} className={className} />
}