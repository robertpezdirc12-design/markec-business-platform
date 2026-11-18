import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr"

interface SendIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function SendIcon({ size = 20, weight = "regular", className = "" }: SendIconProps) {
  return <PaperPlaneRight size={size} weight={weight} className={className} />
}
