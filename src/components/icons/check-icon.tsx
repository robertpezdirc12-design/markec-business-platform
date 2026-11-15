import { Check } from "@phosphor-icons/react/dist/ssr"

interface CheckIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function CheckIcon({ size = 20, weight = "regular", className = "" }: CheckIconProps) {
  return <Check size={size} weight={weight} className={className} />
}
