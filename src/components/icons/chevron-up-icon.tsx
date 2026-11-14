import { CaretUp } from "@phosphor-icons/react/dist/ssr"

interface ChevronUpIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function ChevronUpIcon({ size = 20, weight = "regular", className = "" }: ChevronUpIconProps) {
  return <CaretUp size={size} weight={weight} className={className} />
}