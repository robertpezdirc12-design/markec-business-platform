import { ChatsCircle } from "@phosphor-icons/react/dist/ssr"

interface ChatsCircleIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function ChatsCircleIcon({ size = 20, weight = "regular", className = "" }: ChatsCircleIconProps) {
  return <ChatsCircle size={size} weight={weight} className={className} />
}
