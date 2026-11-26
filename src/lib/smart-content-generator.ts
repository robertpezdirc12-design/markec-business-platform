// ============================================================
// SMART CONTENT GENERATOR (Fresha-inspired 2026-11-15)
// Template-based content generation — works like AI without external APIs.
// Generates SEO meta, product descriptions, email templates, and more.
// ============================================================

// ============================================================
// 1. SEO META DESCRIPTION GENERATOR
// ============================================================

interface SeoInput {
  name: string
  type: "service" | "product" | "category"
  price?: number | null
  category?: string | null
  businessName?: string
  city?: string
}

export function generateSeoDescription(input: SeoInput): string {
  const { name, type, price, businessName, city } = input
  const location = city ? ` v ${city}` : ""
  const business = businessName ? ` | ${businessName}` : ""
  const priceStr = price ? ` že od ${price} €` : ""

  switch (type) {
    case "service":
      return `${name}${priceStr}${location}. Rezervirajte termin online${business}. Profesionalna storitev z izkušenimi strokovnjaki.`
    case "product":
      return `${name}${priceStr}${location}. Kupite online${business}. Kvaliteten izdelek z hitro dostavo.`
    case "category":
      return `Odkrijte ${name}${location}${business}. Široka ponudba kakovostnih storitev po ugodnih cenah.`
    default:
      return `${name}${business}`
  }
}

export function generateSeoTitle(input: SeoInput): string {
  const { name, price, businessName } = input
  const priceStr = price ? ` — od ${price} €` : ""
  const business = businessName ? ` | ${businessName}` : ""
  return `${name}${priceStr}${business}`
}

// ============================================================
// 2. PRODUCT DESCRIPTION GENERATOR
// ============================================================

interface ProductDescriptionInput {
  name: string
  category?: string | null
  price?: number | null
  brand?: string | null
  features?: string[]
}

const productCategoryTemplates: Record<string, string[]> = {
  cosmetics: [
    "{name} je kakovosten izdelek, ki nudi odlične rezultate. Formuliran z najboljšimi sestavinami za vaše zadovoljstvo.",
    "Odkrijte moč izdelka {name}. Profesionalna kakovost za domačo uporabo. Rezultati, ki jih boste opazili.",
  ],
  tools: [
    "{name} je profesionalno orodje za natančno in enostavno uporabo. Zasnovano za trajnost in zanesljivost.",
    "Za profesionalne rezultate potrebujete profesionalno orodje. {name} je vaša prava izbira.",
  ],
  default: [
    "{name} je kakovosten izdelek naše ponudbe. Prepričajte se v kakovost in ugodno ceno.",
    "Priporočamo {name} — izdelek, ki združuje kakovost z dostopno ceno. Vaše zadovoljstvo je naša prioriteta.",
  ],
}

export function generateProductDescription(input: ProductDescriptionInput): string {
  const { name, category, price, brand, features } = input
  
  const templates = productCategoryTemplates[category?.toLowerCase() || "default"] || productCategoryTemplates.default
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  let description = templates[hash % templates.length].replace("{name}", name)
  
  const details: string[] = []
  if (brand) details.push(`🏷️ Znamka: ${brand}`)
  if (price) details.push(`💰 Cena: ${price} €`)
  if (features?.length) {
    details.push(`\n✅ Lastnosti:\n${features.map((f) => `  • ${f}`).join("\n")}`)
  }
  
  if (details.length > 0) {
    description += "\n\n" + details.join("\n")
  }
  
  return description
}

// ============================================================
// 3. SMART CROSS-SELLING SUGGESTIONS
// ============================================================

interface CrossSellInput {
  serviceName: string
  category?: string | null
  allServices?: { name: string; category?: string | null }[]
}

// Rules for cross-selling (like "AI recommendations")
const crossSellRules: Record<string, string[]> = {
  "frizerske storitve": ["Nega las", "Barvanje las", "Styling", "Lasni dodatki"],
  "masaže": ["Refleksoterapija", "Aromaterapija", "Nega telesa", "Sprostitvena terapija"],
  "nega obraza": ["Čiščenje obraza", "Anti-age nega", "Maska za obraz", "Nega oči"],
  "nohti": ["Manikira", "Pedikira", "Gel lak", "Nega rok"],
}

export function getCrossSellSuggestions(input: CrossSellInput): string[] {
  const { serviceName, category } = input
  
  // Find matching category rules
  const categoryLower = category?.toLowerCase() || ""
  for (const [key, suggestions] of Object.entries(crossSellRules)) {
    if (categoryLower.includes(key) || key.includes(categoryLower)) {
      return suggestions.filter((s) => s !== serviceName).slice(0, 3)
    }
  }
  
  // Default suggestions
  return ["Nega", "Sprostitev", "Razvajanje"]
}

// ============================================================
// 4. EMAIL TEMPLATE GENERATOR
// ============================================================

interface EmailTemplateInput {
  type: "confirmation" | "reminder" | "followup" | "birthday" | "promo"
  customerName: string
  serviceName?: string
  date?: string
  time?: string
  staffName?: string
  businessName?: string
}

export function generateEmailContent(input: EmailTemplateInput): { subject: string; body: string } {
  const { type, customerName, serviceName, date, time, staffName, businessName } = input
  const business = businessName || "naše podjetje"
  
  switch (type) {
    case "confirmation":
      return {
        subject: `✅ Potrditev rezervacije — ${serviceName}`,
        body: `Pozdravljeni ${customerName},

vaša rezervacija je bila uspešno potrjena!

📋 Podrobnosti:
• Storitev: ${serviceName}
• Datum: ${date}
• Ura: ${time}
• Strokovnjak: ${staffName}

Veselimo se vašega obiska!

Lep pozdrav,
${business}`,
      }
    
    case "reminder":
      return {
        subject: `⏰ Opomnik — ${serviceName} jutri`,
        body: `Pozdravljeni ${customerName},

spominjamo vas na vaš jutrišnji termin:

📋 Podrobnosti:
• Storitev: ${serviceName}
• Datum: ${date}
• Ura: ${time}

Če ne morete priti, nas pravočasno obvestite.

Lep pozdrav,
${business}`,
      }
    
    case "followup":
      return {
        subject: `Hvala za obisk! 💚`,
        body: `Pozdravljeni ${customerName},

hvala za vaš obisk! Upamo, da ste bili zadovoljni s storitvijo ${serviceName}.

Vaše mnenje nam veliko pomeni. Prosimo, delite vašo izkušnjo.

Lep pozdrav,
${business}`,
      }
    
    case "birthday":
      return {
        subject: `🎂 Vse najboljše, ${customerName}!`,
        body: `Pozdravljeni ${customerName},

ob vašem rojstnem dnevu vam želimo vse najboljše! 🎉

V zahvalo vam podarjamo 10% popust na naslednjo storitev.

Koda: ROJSTNIDAN10

Velja 30 dni.

Lep pozdrav,
${business}`,
      }
    
    case "promo":
      return {
        subject: `✨ Posebna ponudba za vas!`,
        body: `Pozdravljeni ${customerName},

imamo posebno ponudbo samo za vas!

🔥 20% popust na vse storitve ta teden.

Rezervirajte zdaj in izkoristite popust.

Lep pozdrav,
${business}`,
      }
    
    default:
      return { subject: "", body: "" }
  }
}

// ============================================================
// 5. SMART AUTO-CATEGORIZATION
// ============================================================

const categoryKeywords: Record<string, string[]> = {
  "Frizerske storitve": ["striženje", "barvanje", "frizer", "lase", "pričeska", "balayage", "prameni"],
  "Masaže": ["masaža", "sprostitev", "mišice", "bolečina", "relax", "aromaterapija"],
  "Nega obraza": ["obraz", "koža", "akne", "gube", "čiščenje", "piling", "vlaženje"],
  "Nohti": ["nohti", "manikira", "pedikira", "gel", "lak", "urejanje nohtov"],
  "Telo": ["telo", "depilacija", "obloge", "anticelulit", "hujšanje"],
  "Obrvi in trepalnice": ["obrvi", "trepalnice", "barvanje obrvi", "podaljšanje trepalnic"],
}

export function suggestCategory(serviceName: string): string | null {
  const nameLower = serviceName.toLowerCase()
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return category
      }
    }
  }
  
  return null
}

// ============================================================
// 6. PRICE SUGGESTION (based on duration)
// ============================================================

export function suggestPrice(durationMinutes: number, category?: string | null): number {
  // Base rate per minute by category
  const ratesPerMinute: Record<string, number> = {
    "Frizerske storitve": 0.5,
    "Masaže": 0.7,
    "Nega obraza": 0.8,
    "Nohti": 0.6,
    "Telo": 0.65,
  }
  
  const baseRate = ratesPerMinute[category || ""] || 0.5
  
  // Calculate price with rounding to nearest 5
  const price = durationMinutes * baseRate
  return Math.round(price / 5) * 5
}
