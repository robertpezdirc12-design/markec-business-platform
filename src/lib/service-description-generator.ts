// ============================================================
// SERVICE DESCRIPTION GENERATOR (Fresha-inspired 2026-11-15)
// Template-based description generator for services.
// Creates professional descriptions from service attributes.
// Works without external AI APIs — pure templates + logic.
// ============================================================

interface DescriptionInput {
  name: string
  category?: string | null
  duration?: number | null
  price?: number | null
}

// Category-specific description templates
const categoryTemplates: Record<string, string[]> = {
  // Hair / Frizerske storitve
  hair: [
    "Prepustite se rokam naših izkušenih frizerjev in si privoščite spremembo, ki vam bo dvignila samozavest. {name} je storitev, prilagojena vašim željam in tipu las.",
    "Profesionalna frizerska storitev {name}, kjer združujemo najnovejše trende s preverjenimi tehnikami. Rezultat: popolna pričeska, ki traja.",
    "Za sijoče, zdrave in urejene lase poskrbimo s storitvijo {name}. Naši frizerji svetujejo in izvedejo nego, ki najbolje ustreza vašim lasem.",
  ],
  // Beauty / Nega
  beauty: [
    "Razvajajte se s storitvijo {name} in si privoščite trenutek zase. Naši strokovnjaki poskrbijo za sprostitev in vidne rezultate.",
    "{name} je profesionalna nega, ki združuje kakovostne izdelke z izkušenimi rokami. Vaša koža/zdravje vam bo hvaležna.",
    "Prepustite se strokovni negi {name}. Uporabljamo preverjene izdelke in tehnike za najboljše rezultate.",
  ],
  // Massage / Masaže
  massage: [
    "Sprostite telo in um s storitvijo {name}. Naše maserke poskrbijo za popolno sprostitev in regeneracijo.",
    "{name} je popoln način za lajšanje stresa in napetosti. Prepustite se izkušenim rokam in uživajte v miru.",
    "Privoščite si {name} — masažo, ki sprosti mišice, izboljša prekrvavitev in napolni z energijo.",
  ],
  // Nails / Nohti
  nails: [
    "Za popolno urejene nohte poskrbimo s storitvijo {name}. Uporabljamo kakovostne izdelke za dolgotrajen rezultat.",
    "{name} je storitev, ki združuje natančnost z ustvarjalnostjo. Vaši nohti bodo urejeni in privlačni.",
    "Razvajajte svoje roke s storitvijo {name}. Profesionalna nega nohtov za vsako priložnost.",
  ],
  // Default
  default: [
    "{name} je profesionalna storitev, ki jo izvajamo z največjo skrbnostjo in pozornostjo do detajlov. Prepustite se našim izkušenim strokovnjakom.",
    "Za odlične rezultate in zadovoljstvo strank poskrbimo s storitvijo {name}. Prilagodimo se vašim željam in potrebam.",
    "Preizkusite {name} — storitev, ki združuje kakovost, strokovnost in prijetno izkušnjo. Vaše zadovoljstvo je naša prioriteta.",
  ],
}

// Get category key from category name
function getCategoryKey(category?: string | null): string {
  if (!category) return "default"
  const lower = category.toLowerCase()
  if (lower.includes("las") || lower.includes("frizer") || lower.includes("hair")) return "hair"
  if (lower.includes("masaž") || lower.includes("massage")) return "massage"
  if (lower.includes("noht") || lower.includes("nail")) return "nails"
  if (lower.includes("lepota") || lower.includes("beauty") || lower.includes("nega")) return "beauty"
  return "default"
}

// Generate a professional description
export function generateServiceDescription(input: DescriptionInput): string {
  const { name, category, duration, price } = input
  
  const categoryKey = getCategoryKey(category)
  const templates = categoryTemplates[categoryKey] || categoryTemplates.default
  
  // Pick a template based on name hash (deterministic for same service)
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const template = templates[hash % templates.length]
  
  // Replace placeholder
  let description = template.replace("{name}", name)
  
  // Add practical details
  const details: string[] = []
  if (duration) {
    details.push(`⏱️ Trajanje: ${duration} minut`)
  }
  if (price) {
    details.push(`💰 Cena: ${price} €`)
  }
  
  if (details.length > 0) {
    description += "\n\n" + details.join("\n")
  }
  
  return description
}

// Generate multiple variants for user to choose from
export function generateDescriptionVariants(input: DescriptionInput): string[] {
  const { name, category } = input
  const categoryKey = getCategoryKey(category)
  const templates = categoryTemplates[categoryKey] || categoryTemplates.default
  
  return templates.map((template) => {
    let desc = template.replace("{name}", name)
    
    const details: string[] = []
    if (input.duration) details.push(`⏱️ Trajanje: ${input.duration} minut`)
    if (input.price) details.push(`💰 Cena: ${input.price} €`)
    
    if (details.length > 0) {
      desc += "\n\n" + details.join("\n")
    }
    
    return desc
  })
}
