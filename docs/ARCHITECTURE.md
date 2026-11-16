# MARKEC — Arhitektura platforme

> **Ena platforma, eno skupno jedro, več prilagojenih poslovnih sistemov.**

## 🏗️ Arhitekturno načelo

### Zlato pravilo
> *"Skupne funkcije morajo biti resnično univerzalne, ne kopirane za vsako dejavnost."*

### Struktura
```
┌─────────────────────────────────────────────────────────┐
│                    SKUPNO JEDRO                          │
│  Koledar · Stranke · Katalog · Marketing · Nastavitve    │
│  Uporabniki · Vloge · Plačila · E-pošta · Poročila       │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │  SALON  │        │AVTOSERVIS│        │ŠIVILJSTVO│
   │         │        │          │        │          │
   │ +Storitve│       │ +Vozila  │        │ +Mere    │
   │ +Osebje │        │ +Delovni │        │ +Kosi    │
   │ +Termini│        │  nalogi  │        │ +Tkanine │
   └─────────┘        └─────────┘        └─────────┘
```

---

## 📁 Struktura kode

### Skupno jedro (`src/lib/core/`) — NE SPREMINJAJ BREZ PREMISLEKA!

```
src/lib/core/
├── calendar/          → univerzalni koledar (termini, dogodki)
├── customers/         → univerzalni profili strank
├── catalog/           → univerzalni katalog (storitve, izdelki)
├── marketing/         → univerzalni marketing (kampanje, segmenti)
├── appointments/      → univerzalne rezervacije
├── orders/            → univerzalna naročila
├── payments/          → univerzalna plačila
├── notifications/     → univerzalna obvestila
└── reports/           → univerzalna poročila
```

**Pravila za jedro:**
- ✅ Mora delovati za **VSE** dejavnosti
- ✅ Ne sme vsebovati dejavnostno-specifične logike
- ✅ Spremembe morajo biti združljive za vse profile
- ❌ Ne uporabljaj `if (profile === "salon")` v jedru!

### Profili (`src/lib/profiles/`) — DODAJAJ SPROŠČENO!

```
src/lib/profiles/
├── registry.ts        → definicije dejavnosti
├── extensions.ts      → moduli po dejavnostih
├── secondary.ts       → sekundarne vertikale
├── validate.ts        → validacija profilov
│
├── salon/             → salon specifično
│   ├── services.ts    → storitve (striženje, barvanje...)
│   ├── staff.ts       → osebje (frizer, kozmetičarka...)
│   └── terminology.ts → terminologija
│
├── auto-service/      → avtoservis specifično
│   ├── vehicles.ts    → vozila
│   ├── work-orders.ts → delovni nalogi
│   └── terminology.ts → terminologija
│
├── seamstress/        → šiviljstvo specifično
│   ├── measurements.ts → mere
│   ├── fabrics.ts     → tkanine
│   └── terminology.ts → terminologija
│
└── ...
```

**Pravila za profile:**
- ✅ Razširjajo jedro, ne prekrivajo ga
- ✅ Vsak profil definira svojo terminologijo
- ✅ Moduli so vključljivi/izključljivi
- ❌ Ne kopiraj kode iz jedra v profile!

---

## 🔧 Kako deluje razširjanje

### 1. Univerzalni koledar + kontekst

```typescript
// Jedro: koledar je ENAK za vse
<Calendar events={events} />

// Profil: prikaže različne "entitete"
// Salon → Termin (stranka + storitev + osebje)
// Avtoservis → Delovni nalog (vozilo + delo + mehanik)
// Šiviljstvo → Kos (stranka + kroj + šivilja)
```

### 2. Univerzalni profili strank + razširitve

```typescript
// Jedro: osnovni podatki
interface Customer {
  id: string
  name: string
  email: string
  phone: string
  tags: string[]
  notes: string
}

// Profil: razširitve prek ExtensionRecord
// Avtoservis → vehicles: Vehicle[]
// Šiviljstvo → measurements: Measurement[]
// Veterinar → pets: Pet[]
```

### 3. Univerzalni katalog + atributi

```typescript
// Jedro: osnovni atributi
interface CatalogItem {
  id: string
  name: string
  price: number
  category: string
  imageUrl: string
}

// Profil: dodatni atributi
// Mizarstvo → materials: Material[], dimensions: Dimension[]
// Salon → duration: number
// Avtoservis → parts: Part[]
```

### 4. Modulni sistem

```typescript
// Profil definira module
const profile = {
  id: "auto-service",
  modules: {
    appointments: "enabled",    // skupno
    workOrders: "enabled",      // avtoservis specifično
    vehicles: "enabled",        // avtoservis specifično
    measurements: "disabled",   // šiviljstvo specifično
  }
}
```

---

## 📋 Kontrolni seznam za razvijalce

### Ko dodajaš novo funkcijo:

- [ ] **Ali je to univerzalno ali specifično?**
  - Univerzalno → `src/lib/core/`
  - Specifično → `src/lib/profiles/`

- [ ] **Ali deluje za VSE dejavnosti?**
  - Da → jedro
  - Ne → profil

- [ ] **Ali se podatki ločujejo po organizaciji?**
  - Vedno DA! (multi-tenant)

- [ ] **Ali so testi za obe poti?**
  - Test za jedro (vsi profili)
  - Test za profil (specifično)

### Ko spreminjaš jedro:

- [ ] **Ali je sprememba združljiva za vse profile?**
- [ ] **Ali so vsi testi zeleni?**
- [ ] **Ali si preveril vse profile?**
- [ ] **Ali si posodobil dokumentacijo?**

---

## 🧪 Testi arhitekture

### Testi jedra (`tests/core/`)
```typescript
// Preveri da jedro deluje za vse profile
test("calendar works for all profiles", () => {
  for (const profile of ALL_PROFILES) {
    expect(() => renderCalendar(profile)).not.toThrow()
  }
})
```

### Testi profilov (`tests/profiles/`)
```typescript
// Preveri da profil razširja jedro
test("auto-service extends core", () => {
  const profile = getProfile("auto-service")
  expect(profile.modules.vehicles).toBe("enabled")
  expect(profile.modules.measurements).toBe("disabled")
})
```

### Testi izolacije (`tests/isolation/`)
```typescript
// Preveri da podatki niso pomešani med organizacijami
test("data is isolated per organization", async () => {
  const org1Data = await getData(org1.id)
  const org2Data = await getData(org2.id)
  expect(org1Data).not.toEqual(org2Data)
})
```

---

## 📚 Primeri iz prakse

### Primer 1: Dodajanje nove dejavnosti (Veterinar)

```typescript
// 1. Definiraj profil
// src/lib/profiles/veterinary/registry.ts
export const veterinaryProfile = {
  id: "veterinary",
  label: "Veterinar",
  terminology: {
    businessNoun: "veterinarska ambulanta",
    staffNoun: "veterinar",
    customerNoun: "lastnik",
  },
  modules: {
    appointments: "enabled",
    pets: "enabled",        // specifično
    medicalRecords: "enabled", // specifično
  }
}

// 2. Dodaj razširitve
// src/lib/profiles/veterinary/extensions.ts
export const veterinaryExtensions = {
  pets: {
    model: "Pet",
    fields: ["name", "species", "breed", "birthDate"],
  },
  medicalRecords: {
    model: "MedicalRecord",
    fields: ["diagnosis", "treatment", "medications"],
  }
}

// 3. Uporabi univerzalne module
// Koledar, stranke, katalog → NE spreminjaj!
```

### Primer 2: Sprememba jedra (nov filter v koledarju)

```typescript
// 1. Spremeni jedro
// src/lib/core/calendar/Calendar.tsx
export function Calendar({ events, filters }) {
  // Nov filter za vse profile
  const filtered = events.filter(e => filters.every(f => f(e)))
}

// 2. Preveri VSE profile
// tests/core/calendar.test.ts
test("calendar filter works for all profiles", () => {
  for (const profile of ALL_PROFILES) {
    expect(() => renderCalendar(profile, filters)).not.toThrow()
  }
})

// 3. Posodobi dokumentacijo
// docs/ARCHITECTURE.md → dodaj filter v seznam
```

---

## 🎯 Zaključek

**MARKEC arhitektura je:**
- ✅ **Ena platforma** — skupno jedro
- ✅ **Več dejavnosti** — profili z razširitvami
- ✅ **Modularna** — moduli vključljivi/izključljivi
- ✅ **Multi-tenant** — podatki ločeni po organizacijah
- ✅ **Razširljiva** — nova dejavnost v dnevih, ne mesecih

**Zlato pravilo:**
> *"Če ne deluje za VSE, ne sodi v jedro."*

---

*Zadnja posodobitev: November 2026*