import { CaretDown } from "@phosphor-icons/react/dist/ssr"

interface ChevronDownIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function ChevronDownIcon({ size = 20, weight = "regular", className = "" }: ChevronDownIconProps) {
  return <CaretDown size={size} weight={weight} className={className} />
}