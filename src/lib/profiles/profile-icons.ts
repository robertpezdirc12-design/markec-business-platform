// ============================================================
// ACTIVITY ICONS — shared by the guided-entry wizard and the
// dashboard's activity card. Client-safe AND server-safe
// (no "use client" directive): lucide icons render fine in
// server components, so both worlds import the same map and
// never drift apart.
// ============================================================

import {
  Briefcase,
  Building2,
  Car,
  Clapperboard,
  Droplets,
  Factory,
  Feather,
  Flower2,
  Gem,
  Globe,
  GraduationCap,
  Hand,
  HardHat,
  Hexagon,
  Home,
  House,
  Landmark,
  LayoutGrid,
  MonitorSmartphone,
  Pickaxe,
  Ruler,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkle,
  Sparkles,
  Sprout,
  Stethoscope,
  Truck,
  Trophy,
  UtensilsCrossed,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

export const PROFILE_ICONS: Record<string, LucideIcon> = {
  beauty: Sparkles,
  frizer: Scissors,
  barber: Scissors,
  nails: Gem,
  cosmetica: Flower2,
  massage: Hand,
  epilation: Feather,
  generic: LayoutGrid,
  seamstress: Ruler,
  "tire-service": Wrench,
  // #100-nadaljevanje: avtomehanik — svoja ikona (ločen profil).
  mehanik: Car,
  beekeeping: Hexagon,

  // --- F5.0.2: ikone za 22 SKD 2025 sekcijskih profilov (A–V).
  // Samo prikaz; poslovna logika profilov je nespremenjena.
  "skd-a-agriculture": Sprout,
  "skd-b-mining": Pickaxe,
  "skd-c-manufacturing": Factory,
  "skd-d-energy": Zap,
  "skd-e-water-waste": Droplets,
  "skd-f-construction": HardHat,
  "skd-g-retail": ShoppingBag,
  "skd-h-transport": Truck,
  "skd-i-hospitality": UtensilsCrossed,
  "skd-j-media": Clapperboard,
  "skd-k-digital": MonitorSmartphone,
  "skd-l-finance": Landmark,
  "skd-m-real-estate": House,
  "skd-n-professional": Briefcase,
  "skd-o-other-business": Building2,
  "skd-p-public-admin": Shield,
  "skd-q-education": GraduationCap,
  "skd-r-health": Stethoscope,
  "skd-s-culture-sport": Trophy,
  "skd-t-other": Sparkle,
  "skd-u-households": Home,
  "skd-v-international": Globe,
}

/** Icon for a profile id — unknown ids fall back to the neutral grid. */
export function iconForProfile(id: string): LucideIcon {
  return PROFILE_ICONS[id] ?? LayoutGrid
}
