// T9 (bundle 2026-11): javna PODMNOŽICA slovarjev.
//
// Problem: `dictionaries.ts` statično vleče VSE slovarske območja
// (settings 62 KB, dashboard, catalog-docs, … — skupaj 256 KB surovega
// teksta), `AdminI18nProvider` pa je client komponenta, ki kliče
// getDictionary() → celoten paket je potoval na VSAKO javno stran.
//
// Rešitev: strežnik (RSC) resi slovar in ga poda kot prop — client bundle
// NE vsebuje več dictionaries.ts. Javne strani (public/customer/auth)
// dobijo samo to podmnožico (common/public/landing/auth/booking/orders/
// categories/promotions); admin dobiva celoten slovar prek svojega
// layouta (za admin je velikost nizka prioriteta).
//
// OPOMBA o tipih: subset je tipovsko ožji od Dictionary — cast je
// dokumentiran tukaj; javne komponente nikoli ne dostopajo admin ključev
// (t.settings.x itd.), zato manjkajoči ključi niso dosegljivi.

import { Locale } from "./config"
import type { Dictionary } from "./dictionaries"
import { commonSl, commonEn } from "./dict/common"
import { publicSl, publicEn } from "./dict/public"
import { landingSl, landingEn } from "./dict/landing"
import { authSl, authEn } from "./dict/auth"
import { bookingSl, bookingEn } from "./dict/booking"
import { ordersSl, ordersEn } from "./dict/orders"
import { categoriesSl, categoriesEn } from "./dict/categories"
import { promotionsSl, promotionsEn } from "./dict/promotions"

const publicDictionaries = {
  sl: {
    common: commonSl,
    public: publicSl,
    landing: landingSl,
    auth: authSl,
    booking: bookingSl,
    orders: ordersSl,
    categories: categoriesSl,
    promotions: promotionsSl,
  },
  en: {
    common: commonEn,
    public: publicEn,
    landing: landingEn,
    auth: authEn,
    booking: bookingEn,
    orders: ordersEn,
    categories: categoriesEn,
    promotions: promotionsEn,
  },
} as const

export function getPublicDictionary(locale: Locale): Dictionary {
  return locale === "en"
    ? (publicDictionaries.en as unknown as Dictionary)
    : (publicDictionaries.sl as unknown as Dictionary)
}
