import { Dot } from "@phosphor-icons/react/dist/ssr"

interface DotFilledIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function DotFilledIcon({ size = 20, weight = "fill", className = "" }: DotFilledIconProps) {
  return <Dot size={size} weight={weight} className={className} />
}
