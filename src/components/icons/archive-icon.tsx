import { Archive } from "@phosphor-icons/react/dist/ssr"

interface ArchiveIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function ArchiveIcon({ size = 20, weight = "regular", className = "" }: ArchiveIconProps) {
  return <Archive size={size} weight={weight} className={className} />
}