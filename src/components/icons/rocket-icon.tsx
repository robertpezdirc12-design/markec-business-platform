import { Rocket } from "@phosphor-icons/react/dist/ssr"

interface RocketIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function RocketIcon({ size = 20, weight = "regular", className = "" }: RocketIconProps) {
  return <Rocket size={size} weight={weight} className={className} />
}