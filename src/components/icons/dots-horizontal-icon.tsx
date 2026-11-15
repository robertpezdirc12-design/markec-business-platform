import { DotsThree } from "@phosphor-icons/react/dist/ssr"

interface DotsHorizontalIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function DotsHorizontalIcon({ size = 20, weight = "regular", className = "" }: DotsHorizontalIconProps) {
  return <DotsThree size={size} weight={weight} className={className} />
}
