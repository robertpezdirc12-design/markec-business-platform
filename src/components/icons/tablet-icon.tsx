import { DeviceTablet } from "@phosphor-icons/react/dist/ssr"

interface TabletIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function TabletIcon({ size = 20, weight = "regular", className = "" }: TabletIconProps) {
  return <DeviceTablet size={size} weight={weight} className={className} />
}