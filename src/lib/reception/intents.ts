/**
 * EPIC 5 — Skriptni recepcionist: ČISTO jedro (brez prisma/next/auth).
 *
 * `classifyIntent()` razvrsti obiskovalčev niz v eno od 7 namenov s pomočjo
 * ključnih besed (SL + EN, normalizacija dijakritik, \b mejami besed).
 * `buildReply()` zgradi avtomatski odgovor IZKJUČNO iz podatkov, ki jih
 * strežnik poda v kontekstu (cena/ura/naslov iz DB) — bot ne more izmisliti
 * podatka: brez telefona v besedilu ni telefona, brez storitev ni cenika.
 *
 * To je ENA točka, ki se v v2 nadgradi z LLM fallback (E5-D5): razvrstitev
 * pade na "help", takrat LLM samo izbere med temi istimi nameni.
 */

export type Locale = "sl" | "en"

export type ChatIntent =
  | "book"
  | "waitlist"
  | "prices"
  | "hours"
  | "location"
  | "cancel"
  | "greeting"
  | "help"

export interface ReceptionAction {
  label: string
  href: string
}

export interface ReceptionReply {
  text: string
  action?: ReceptionAction
  /** Hitri predlogi (čipki) pod odgovorom — besedilo, ki se pošlje kot
   *  obiskovalčevo sporočilo. Vse obstoječe namene pokrivajo. */
  suggested: string[]
}

/** Kontekst, ki ga strežnik sestavi iz baze (org + config + storitve). */
export interface ReceptionContext {
  locale: Locale
  orgName: string
  phone: string | null
  address: string | null
  city: string | null
  /** Formatirane ure (day + "09:00–18:00" / "Zaprto") — iz siteContent. */
  hours: { day: string; value: string }[]
  /** Izbrane storitve za cenik (do 8) — iz aktivnega kataloga. */
  services: { name: string; price: number; durationMin: number }[]
  bookingHref: string
  servicesHref: string
}

// ------------------------------------------------------------
// Normalizacija: majhne črke + odstranjeni dijakritiki (č→c).
// Ključne besede so ASCII; \b meje besed preprečijo lažne zadetke
// ("ure" v "kulture" ne zadene — pred tem je 't', besedna znak).
// ------------------------------------------------------------
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
}

const KEYWORDS: Record<Exclude<ChatIntent, "help">, Record<Locale, string[]>> = {
  cancel: {
    sl: ["preklic", "preklicem", "preklicati", "prekljuc", "odpoved", "odpovem", "odpove", "odpovedati", "prestavi", "prestavim", "prestava", "prelozi", "prelozim", "preloziti", "zamakni", "zamaknit"],
    en: ["cancel", "cancelling", "reschedule", "postpone", "call off", "move my appointment"],
  },
  waitlist: {
    sl: ["cakalna", "cakalne", "cakalnem", "cakalno", "vrsta", "vrsti"],
    en: ["waitlist", "waiting list", "put me on the list"],
  },
  prices: {
    sl: ["cena", "cene", "ceni", "cenik", "cenika", "cenah", "koliko stane", "stane", "plac", "placilo", "drago"],
    en: ["price", "prices", "cost", "costs", "how much", "rate", "rates"],
  },
  hours: {
    sl: ["kdaj", "odprt", "odprta", "odprto", "odpiralno", "delovni", "delovne", "delovanje", "zaprt", "zaprla", "ure"],
    en: ["open", "hours", "hour", "closing", "opening"],
  },
  location: {
    sl: ["kje", "kjer", "naslov", "naslovu", "naslova", "lokacija", "lokal", "parkir", "parkiri", "mapa"],
    en: ["where", "address", "location", "map", "parking", "directions"],
  },
  book: {
    // "uro" ("Rezerviraj mi uro") ni tu — ur posega samo z "kdaj/odprti/delovne".
    // "termin" je tu: "Rezerviraj mi uro" → book (termin je specifičnejši od ure).
    sl: ["rezervir", "rezervac", "termin", "dogovor", "prosta", "proste", "prosto", "prosti"],
    en: ["book", "booking", "appointment", "reserve", "reservations", "slot", "slots"],
  },
  greeting: {
    sl: ["pozdrav", "zdravo", "dober dan", "dobro jutro", "dober vecer", "hvala", "hvalce", "hi", "hej"],
    en: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "thanks", "thank you", "welcome"],
  },
}

// Vrsta razvrščanja = prioritetni (najbolj specifični najprej).
// "prekljic termina" → cancel, ne book; "cakalna lista za termin" → waitlist.
const PRIORITY: Exclude<ChatIntent, "help">[] = [
  "cancel",
  "waitlist",
  "prices",
  "hours",
  "location",
  "book",
  "greeting",
]

function hasKeyword(
  normalized: string,
  locale: Locale,
  intent: Exclude<ChatIntent, "help">
): boolean {
  const words = KEYWORDS[intent][locale]
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`\\b${escaped}`, "u").test(normalized)) return true
  }
  return false
}

/**
 * Razvrsti obiskovalčev niz. `help` = privzeto, ko nič ne zadene.
 * Čista funkcija — deterministična, testna.
 */
export function classifyIntent(text: string, locale: Locale): ChatIntent {
  const normalized = normalizeText(text)
  for (const intent of PRIORITY) {
    if (hasKeyword(normalized, locale, intent)) return intent
  }
  return "help"
}

// ------------------------------------------------------------
// Besedila (SL/EN)
// ------------------------------------------------------------
const COPY = {
  sl: {
    book: {
      text: (name: string) =>
        `Vabljamo vas, da izberete storitev in prosto uro — rezervacija v ${name} traja le nekaj minut.`,
      action: "Rezerviraj",
    },
    waitlist: {
      text:
        "Prosti termini se hitro izpolnjujejo. Vpišite se na čakalno listo in vas bomo obvestili, ko se sprosti uro.",
      action: "Na čakalno listo",
    },
    prices: {
      intro: "Naše storitve in cene:",
      more: "Poglejte popoln cenik:",
      action: "Poglej cenik",
      empty: "Cenik trenutno ni na voljo.",
      phoneSuffix: (phone: string) => ` Vprašate lahko tudi: ${phone}.`,
    },
    hours: {
      intro: "Naši delovni ur:",
      action: null as null,
    },
    location: {
      text: (address: string, city: string) =>
        city ? `Naslov: ${address}, ${city}` : `Naslov: ${address}`,
      phoneSuffix: (phone: string) => ` Telefon: ${phone}`,
      phoneAction: "Pokličite",
    },
    cancel: {
      login:
        "Za preklic ali prestavitev termina se prijavite v svoj profil in ga najdete v 'Moji termini'.",
      phone: (phone: string) => ` Lajše je poklicati: ${phone}.`,
      phoneAction: "Pokličite",
    },
    greeting: {
      text: (name: string) => `Dobrodošli v ${name}! Kako vam lahko pomagam?`,
    },
    help: {
      text: (name: string, phone: string | null) =>
        `Ne razumem vašega vprašanja. Izberite eno od spodnjih možnosti ali nas pokličite${phone ? `: ${phone}` : ""} — v ${name} vam z veseljem pomagamo.`,
      phoneAction: "Pokličite",
    },
  },
  en: {
    book: {
      text: (name: string) =>
        `Pick a service and an open time slot — booking at ${name} takes only a couple of minutes.`,
      action: "Book now",
    },
    waitlist: {
      text:
        "Open slots fill up quickly. Join the waitlist and we'll let you know as soon as one frees up.",
      action: "Join the waitlist",
    },
    prices: {
      intro: "Our services and prices:",
      more: "See the full price list:",
      action: "See prices",
      empty: "Our price list isn't available right now.",
      phoneSuffix: (phone: string) => ` Feel free to call: ${phone}.`,
    },
    hours: {
      intro: "Our opening hours:",
      action: null as null,
    },
    location: {
      text: (address: string, city: string) =>
        city ? `Address: ${address}, ${city}` : `Address: ${address}`,
      phoneSuffix: (phone: string) => ` Phone: ${phone}`,
      phoneAction: "Call us",
    },
    cancel: {
      login:
        "To cancel or reschedule an appointment, sign in to your profile and find it under 'My appointments'.",
      phone: (phone: string) => ` Easier: just call ${phone}.`,
      phoneAction: "Call us",
    },
    greeting: {
      text: (name: string) => `Welcome to ${name}! How can I help you?`,
    },
    help: {
      text: (name: string, phone: string | null) =>
        `I'm not sure I understood. Pick one of the options below, or call us${phone ? `: ${phone}` : ""} — we're happy to help at ${name}.`,
      phoneAction: "Call us",
    },
  },
} as const

export const SUGGESTED_CHIPS: Record<Locale, string[]> = {
  sl: ["Kdaj ste odprti?", "Poglej cenik", "Želim termin", "Kje ste?"],
  en: ["When are you open?", "See prices", "I want an appointment", "Where are you?"],
}

function formatPrice(price: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === "sl" ? "sl-SI" : "en-GB", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  } catch {
    return `${price} €`
  }
}

function serviceLine(s: { name: string; price: number; durationMin: number }, locale: Locale): string {
  const dur = s.durationMin > 0 ? ` · ${s.durationMin} min` : ""
  return `• ${s.name} — ${formatPrice(s.price, locale)}${dur}`
}

/** Zgradi avtomatski odgovor za namen iz konteksta. Čista funkcija. */
export function buildReply(intent: ChatIntent, ctx: ReceptionContext): ReceptionReply {
  const c = COPY[ctx.locale]
  const suggested = SUGGESTED_CHIPS[ctx.locale]
  const phoneHref = ctx.phone ? `tel:${ctx.phone.replace(/\s+/g, "")}` : null

  switch (intent) {
    case "book":
      return {
        text: c.book.text(ctx.orgName),
        action: { label: c.book.action, href: ctx.bookingHref },
        suggested,
      }

    case "waitlist":
      return {
        text: c.waitlist.text,
        action: { label: c.waitlist.action, href: ctx.bookingHref },
        suggested,
      }

    case "prices": {
      if (ctx.services.length === 0) {
        const phonePart = ctx.phone ? c.prices.phoneSuffix(ctx.phone) : ""
        return {
          text: c.prices.empty + phonePart,
          ...(phoneHref ? { action: { label: c.location.phoneAction, href: phoneHref } } : {}),
          suggested,
        }
      }
      const lines = ctx.services.slice(0, 8).map((s) => serviceLine(s, ctx.locale))
      return {
        text: `${c.prices.intro}\n${lines.join("\n")}\n\n${c.prices.more}`,
        action: { label: c.prices.action, href: ctx.servicesHref },
        suggested,
      }
    }

    case "hours": {
      if (ctx.hours.length === 0) {
        const phonePart = ctx.phone ? c.prices.phoneSuffix(ctx.phone) : ""
        return {
          text: c.prices.empty + phonePart,
          suggested,
        }
      }
      return {
        text: `${c.hours.intro}\n${ctx.hours.map((h) => `• ${h.day}: ${h.value}`).join("\n")}`,
        suggested,
      }
    }

    case "location": {
      if (!ctx.address) {
        const phonePart = ctx.phone ? c.prices.phoneSuffix(ctx.phone) : ""
        return {
          text: `${c.prices.empty}${phonePart}`,
          suggested,
        }
      }
      const text =
        c.location.text(ctx.address, ctx.city ?? "") +
        (ctx.phone ? c.location.phoneSuffix(ctx.phone) : "")
      return {
        text,
        ...(phoneHref ? { action: { label: c.location.phoneAction, href: phoneHref } } : {}),
        suggested,
      }
    }

    case "cancel": {
      const text = c.cancel.login + (ctx.phone ? c.cancel.phone(ctx.phone) : "")
      return {
        text,
        ...(phoneHref ? { action: { label: c.cancel.phoneAction, href: phoneHref } } : {}),
        suggested,
      }
    }

    case "greeting":
      return {
        text: c.greeting.text(ctx.orgName),
        suggested,
      }

    case "help":
    default:
      return {
        text: c.help.text(ctx.orgName, ctx.phone),
        ...(phoneHref ? { action: { label: c.help.phoneAction, href: phoneHref } } : {}),
        suggested,
      }
  }
}
