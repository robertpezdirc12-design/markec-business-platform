import { Wallet } from "@phosphor-icons/react/dist/ssr"

interface WalletIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function WalletIcon({ size = 20, weight = "regular", className = "" }: WalletIconProps) {
  return <Wallet size={size} weight={weight} className={className} />
}
