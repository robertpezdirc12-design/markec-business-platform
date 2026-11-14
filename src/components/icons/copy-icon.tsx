import { Copy } from "@phosphor-icons/react/dist/ssr"

interface CopyIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function CopyIcon({
  size = 20,
  weight = "regular",
  className = "",
}: CopyIconProps) {
  return <Copy size={size} weight={weight} className={className} />
}
