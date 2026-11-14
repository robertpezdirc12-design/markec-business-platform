"use client"

// P3-H — javni filtri trgovine (server-side URL parametri, client drop downs).
// Vsaka sprememba zgradi URL (ohrani iskanje + ostale filtre) in router.push
// — enako kot SearchInput. Brez client Jave hydration odvisnosti.

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Locale = "sl" | "en"

interface ShopFiltersProps {
  orgPrefix: string
  categories: { id: string; name: string }[]
  active: { search?: string; category?: string; inStock?: boolean; sort?: string }
  locale: Locale
}

function buildUrl(
  orgPrefix: string,
  active: ShopFiltersProps["active"],
  patch: { category?: string; inStock?: boolean; sort?: string }
): string {
  const params = new URLSearchParams()
  if (active.search) params.set("search", active.search)
  // category: "" / "all" pomeni vse; "none" = brez kategorije.
  const category = patch.category !== undefined ? patch.category : active.category
  if (category && category !== "all") params.set("category", category)
  if (patch.inStock !== undefined) {
    if (patch.inStock) params.set("inStock", "1")
  } else if (active.inStock) {
    params.set("inStock", "1")
  }
  const sort = patch.sort !== undefined ? patch.sort : active.sort
  if (sort && sort !== "featured") params.set("sort", sort)
  const qs = params.toString()
  return qs ? `${orgPrefix}/shop?${qs}` : `${orgPrefix}/shop`
}

export function ShopFilters({ orgPrefix, categories, active, locale }: ShopFiltersProps) {
  const router = useRouter()
  const t = {
    category: locale === "en" ? "Category" : "Kategorija",
    all: locale === "en" ? "All categories" : "Vse kategorije",
    none: locale === "en" ? "Uncategorised" : "Brez kategorije",
    stock: locale === "en" ? "Availability" : "Razpoložljivost",
    stockAny: locale === "en" ? "All items" : "Vsi izdelki",
    inStock: locale === "en" ? "In stock" : "Na zalogi",
    sort: locale === "en" ? "Sort" : "Razvrsti",
    featured: locale === "en" ? "Featured" : "Priporočeno",
    priceAsc: locale === "en" ? "Price: low to high" : "Cena: naraščajoče",
    priceDesc: locale === "en" ? "Price: high to low" : "Cena: padajoče",
    newest: locale === "en" ? "Newest" : "Najnovejše",
  }

  const go = (patch: { category?: string; inStock?: boolean; sort?: string }) =>
    router.push(buildUrl(orgPrefix, active, patch))

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Kategorija */}
      <SelectValueWrap
        value={active.category ?? "all"}
        placeholder={t.category}
        onValueChange={(v) => go({ category: v })}
        items={[
          { value: "all", label: t.all },
          { value: "none", label: t.none },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      {/* Razpoložljivost */}
      <SelectValueWrap
        value={active.inStock ? "in" : "any"}
        placeholder={t.stock}
        onValueChange={(v) => go({ inStock: v === "in" })}
        items={[
          { value: "any", label: t.stockAny },
          { value: "in", label: t.inStock },
        ]}
      />
      {/* Razvrstitev */}
      <SelectValueWrap
        value={active.sort ?? "featured"}
        placeholder={t.sort}
        onValueChange={(v) => go({ sort: v })}
        items={[
          { value: "featured", label: t.featured },
          { value: "price-asc", label: t.priceAsc },
          { value: "price-desc", label: t.priceDesc },
          { value: "newest", label: t.newest },
        ]}
      />
    </div>
  )
}

interface WrapItem {
  value: string
  label: string
}

function SelectValueWrap({
  value,
  placeholder,
  onValueChange,
  items,
}: {
  value: string
  placeholder: string
  onValueChange: (v: string) => void
  items: WrapItem[]
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-44 bg-background text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}