import { FloppyDisk } from "@phosphor-icons/react/dist/ssr"

interface SaveIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function SaveIcon({ size = 20, weight = "regular", className = "" }: SaveIconProps) {
  return <FloppyDisk size={size} weight={weight} className={className} />
}