import { DeviceMobile } from "@phosphor-icons/react/dist/ssr"

interface SmartphoneIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function SmartphoneIcon({ size = 20, weight = "regular", className = "" }: SmartphoneIconProps) {
  return <DeviceMobile size={size} weight={weight} className={className} />
}