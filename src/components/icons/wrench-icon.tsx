import { Wrench } from "@phosphor-icons/react/dist/ssr"

interface WrenchIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function WrenchIcon({
  size = 20,
  weight = "regular",
  className = "",
}: WrenchIconProps) {
  return <Wrench size={size} weight={weight} className={className} />
}
