import { Tag } from "@phosphor-icons/react/dist/ssr"

interface TagIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function TagIcon({ size = 20, weight = "regular", className = "" }: TagIconProps) {
  return <Tag size={size} weight={weight} className={className} />
}