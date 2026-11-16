# Vodnik: Dodajanje nove poslovne dejavnosti

> **Kako v MARKEC dodati novo dejavnost (vertikalo) v nekaj urah, ne mesecih.**

## 📋 Pred začetkom

### Preveri arhitekturna pravila:
- [ ] Preberi [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] Razumi ločnico: **jedro** (univerzalno) vs **profil** (specifično)
- [ ] Preveri da nova dejavnost NE zahteva spreminjanja jedra

---

## 🚀 Korak 1: Definiraj profil

### Ustvari mapo za profil:
```
src/lib/profiles/{ime-dejavnosti}/
├── registry.ts        → definicija profila
├── terminology.ts     → terminologija
├── extensions.ts      → razširitve (opcionalno)
└── modules.ts         → moduli (opcionalno)
```

### Primer: `src/lib/profiles/veterinary/registry.ts`
```typescript
import { ActivityProfile } from "../types"

export const veterinaryProfile: ActivityProfile = {
  id: "veterinary",
  label: "Veterinar",
  labelEn: "Veterinary",
  description: "Veterinarska ambulanta za male živali",
  
  // Terminologija — KAJ vidi uporabnik
  terminology: {
    appointmentSingular: { sl: "Pregled", en: "Appointment" },
    appointmentPlural: { sl: "Pregledi", en: "Appointments" },
    orderSingular: { sl: "Račun", en: "Order" },
    orderPlural: { sl: "Računi", en: "Orders" },
    serviceSingular: { sl: "Storitev", en: "Service" },
    servicePlural: { sl: "Storitve", en: "Services" },
    productSingular: { sl: "Izdelek", en: "Product" },
    productPlural: { sl: "Izdelki", en: "Products" },
    customerSingular: { sl: "Lastnik", en: "Owner" },
    customerPlural: { sl: "Lastniki", en: "Owners" },
    businessSingular: { sl: "ambulanta", en: "clinic" },
    businessIn: { sl: "v ambulanti", en: "at the clinic" },
    businessGenitive: { sl: "ambulante", en: "clinic's" },
    bookingCta: { sl: "Rezerviraj pregled", en: "Book appointment" },
  },
  
  // Zmožnosti — KAJ lahko počne
  capabilities: {
    appointments: "enabled",
    workOrders: "disabled",
    shop: "enabled",
    services: "enabled",
    inventory: "enabled",
    customers: "enabled",
    staff: "enabled",
    analytics: "enabled",
    // ... ostalo
  },
  
  // Moduli — KAJ vidi v sidebar-ju
  modules: [
    "appointments",
    "customers",
    "services",
    "inventory",
    "staff",
    "analytics",
  ],
  
  // Ikone, barve, itd.
  icon: "🏥",
  color: "#10B981",
}
```

---

## 🔧 Korak 2: Dodaj terminologijo

### `src/lib/profiles/veterinary/terminology.ts`
```typescript
// Če potrebuješ dodatno terminologijo specifično za to dejavnost
export const veterinaryTerminology = {
  // Dodatni termini, ki niso v osnovnem TerminologySet
  petSingular: { sl: "Hišni ljubljenček", en: "Pet" },
  petPlural: { sl: "Hišni ljubljenčki", en: "Pets" },
  ownerSingular: { sl: "Lastnik", en: "Owner" },
  ownerPlural: { sl: "Lastniki", en: "Owners" },
  medicalRecord: { sl: "Zdravstveni karton", en: "Medical record" },
}
```

---

## 📦 Korak 3: Dodaj razširitve (opcionalno)

### `src/lib/profiles/veterinary/extensions.ts`
```typescript
import { ExtensionDefinition } from "../types"

// Razširitev za hišne ljubljenčke
export const petsExtension: ExtensionDefinition = {
  id: "pets",
  label: "Hišni ljubljenčki",
  labelEn: "Pets",
  
  model: "Pet",  // Prisma model
  
  fields: [
    { name: "name", type: "string", label: "Ime", required: true },
    { name: "species", type: "string", label: "Vrsta", required: true },
    { name: "breed", type: "string", label: "Pasma", required: false },
    { name: "birthDate", type: "date", label: "Datum rojstva", required: false },
    { name: "weight", type: "number", label: "Teža (kg)", required: false },
    { name: "microchipNumber", type: "string", label: "Številka mikročipa", required: false },
  ],
  
  // Povezava z Customer (lastnik)
  relation: {
    model: "Customer",
    field: "pets",
    type: "one-to-many",
  },
}

// Razširitev za zdravstvene kartone
export const medicalRecordsExtension: ExtensionDefinition = {
  id: "medicalRecords",
  label: "Zdravstveni kartoni",
  labelEn: "Medical records",
  
  model: "MedicalRecord",
  
  fields: [
    { name: "diagnosis", type: "string", label: "Diagnoza", required: true },
    { name: "treatment", type: "string", label: "Zdravljenje", required: true },
    { name: "medications", type: "string", label: "Zdravila", required: false },
    { name: "notes", type: "text", label: "Opombe", required: false },
    { name: "visitDate", type: "date", label: "Datum obiska", required: true },
  ],
  
  // Povezava z Pet
  relation: {
    model: "Pet",
    field: "medicalRecords",
    type: "one-to-many",
  },
}
```

---

## 🗄️ Korak 4: Prisma schema (če potrebuješ nove modele)

### Dodaj v `prisma/schema.prisma`:
```prisma
// Veterinary specifični modeli
model Pet {
  id          String   @id @default(cuid())
  name        String
  species     String
  breed       String?
  birthDate   DateTime?
  weight      Float?
  microchipNumber String?
  
  // Povezava z Customer (lastnik)
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  
  // Zdravstveni kartoni
  medicalRecords MedicalRecord[]
  
  // Multi-tenant
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model MedicalRecord {
  id          String   @id @default(cuid())
  diagnosis   String
  treatment   String
  medications String?
  notes       String?
  visitDate   DateTime
  
  // Povezava z Pet
  petId       String
  pet         Pet      @relation(fields: [petId], references: [id])
  
  // Multi-tenant
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Dodaj relacije v obstoječe modele:
```prisma
model Customer {
  // ... obstoječa polja
  
  // Veterinary razširitev
  pets Pet[]
}
```

---

## 🎨 Korak 5: UI komponente (opcionalno)

### Če potrebuješ specifične komponente:
```
src/components/veterinary/
├── pet-list.tsx           → seznam hišnih ljubljenčkov
├── pet-form.tsx           → obrazec za ljubljenčka
├── medical-record-card.tsx → kartica zdravstvenega kartona
└── ...
```

### Primer: `src/components/veterinary/pet-list.tsx`
```tsx
"use client"

import { Pet } from "@prisma/client"

interface PetListProps {
  pets: Pet[]
  customerId: string
}

export function PetList({ pets, customerId }: PetListProps) {
  return (
    <div className="space-y-4">
      <h3>Hišni ljubljenčki</h3>
      {pets.map((pet) => (
        <div key={pet.id} className="border rounded-lg p-4">
          <h4>{pet.name}</h4>
          <p>{pet.species} {pet.breed && `• ${pet.breed}`}</p>
        </div>
      ))}
    </div>
  )
}
```

---

## ✅ Korak 6: Registriraj profil

### Dodaj v `src/lib/profiles/registry.ts`:
```typescript
import { veterinaryProfile } from "./veterinary/registry"

// Dodaj v PROFILE_LIST
const PROFILE_LIST: ActivityProfile[] = [
  // ... obstoječi profili
  veterinaryProfile,  // ← DODAJ TO
]
```

---

## 🧪 Korak 7: Testi

### Ustvari teste za profil:
```typescript
// tests/profiles/veterinary.test.ts
import { describe, it, expect } from "vitest"
import { getProfile } from "@/lib/profiles/registry"
import { modulesForVertical } from "@/lib/profiles/modules"

describe("Veterinary Profile", () => {
  it("ima pravilno terminologijo", () => {
    const profile = getProfile("veterinary")
    expect(profile.terminology.customerSingular.sl).toBe("Lastnik")
    expect(profile.terminology.businessSingular.sl).toBe("ambulanta")
  })
  
  it("ima pravilne module", () => {
    const modules = modulesForVertical("veterinary")
    const moduleKeys = modules.map((m) => m.key)
    
    expect(moduleKeys).toContain("appointments")
    expect(moduleKeys).toContain("customers")
    expect(moduleKeys).toContain("services")
  })
  
  it("deluje z jedrom", () => {
    // Preveri da profil ne krši jedra
    const profile = getProfile("veterinary")
    expect(profile.capabilities.appointments).toBe("enabled")
  })
})
```

### Poženi teste:
```bash
npx vitest run tests/profiles/veterinary.test.ts
npx vitest run tests/architecture/  # Arhitekturni testi
```

---

## 📝 Korak 8: Dokumentacija

### Dodaj v `docs/ARCHITECTURE.md`:
```markdown
### Veterinary (Veterinar)
- **Terminologija**: Lastnik, Hišni ljubljenček, Zdravstveni karton
- **Razširitve**: pets, medicalRecords
- **Moduli**: appointments, customers, services, inventory, staff
- **Specifično**: Zdravstveni kartoni, Mikročipi, Teža
```

---

## 🎯 Kontrolni seznam pred zaključkom

- [ ] Profil registriran v `registry.ts`
- [ ] Terminologija popolna (SL + EN)
- [ ] Razširitve delujejo (če obstajajo)
- [ ] Prisma schema posodobljen (če potrebuješ nove modele)
- [ ] UI komponente delujejo (če obstajajo)
- [ ] Testi zeleni
- [ ] Arhitekturni testi zeleni
- [ ] Dokumentacija posodobljena

---

## ⚠️ Pogoste napake

### ❌ NE POČNI TEGA:
```typescript
// V JEDRU (src/lib/core/calendar/):
if (profile === "veterinary") {
  // Specifična logika → NAROBE!
}
```

### ✅ POČNI TAKO:
```typescript
// V PROFILU (src/lib/profiles/veterinary/):
export const veterinaryCalendarConfig = {
  entityLabel: "Pregled",
  // ... specifične nastavitve
}

// Jedro uporabi konfiguracijo profila
<Calendar config={profile.calendarConfig} />
```

---

## 🎉 Zaključek

**Nova dejavnost je dodana!**

Čas: **2-4 ure** (namesto 2-4 tednov brez arhitekture)

Naslednji koraki:
1. Testiraj z resničnimi podatki
2. Zberi povratne informacije uporabnikov
3. Izboljšaj specifične module
4. Ponovi za naslednjo dejavnostjo!

---

*Potrebujete pomoč? Preberite [ARCHITECTURE.md](./ARCHITECTURE.md) ali vprašajte ekipo.*