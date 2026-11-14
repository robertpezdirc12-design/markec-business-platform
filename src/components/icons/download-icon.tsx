import { Download } from "@phosphor-icons/react/dist/ssr"

interface DownloadIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function DownloadIcon({ size = 20, weight = "regular", className = "" }: DownloadIconProps) {
  return <Download size={size} weight={weight} className={className} />
}