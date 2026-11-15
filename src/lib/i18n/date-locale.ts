// T9 (bundle 2026-11): datumski locale LOČEN od dictionaries.ts.
//
// Client komponente (booking wizard) rabijo samo date-fns locale — če bi
// ga vlekle iz dictionaries.ts, bi client bundle dobil VSE slovarje
// (256 KB). Ta modul je majhen in varen za client import.
// Server strani lahko še naprej uporabljajo re-export iz dictionaries.ts.

import { sl as dfSl, enUS as dfEnUS } from "date-fns/locale"
import { Locale } from "./config"

export function getDateFnsLocale(locale: Locale) {
  return locale === "sl" ? dfSl : dfEnUS
}
