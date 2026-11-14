"use client"

// ============================================================
// DEMO TOUR SCENES — realistični NAVIDEZNI prikazi nadzorne
// plošče, ki se v video turi izrišejo v samem brskalniku.
//
// Prikazujejo DEJANSKO delo s programom (vpisna polja, tabele,
// števce) — ne velikih fotografij panjev. Vrednosti v poljih so
// vzorčne, da podjetnik vidi "kaj se tu vpiše". Poudarjeno polje
// dobi animiran krožec + oznako, kam naj klikne / kaj naj vpiše.
//
// Uporablja iste shadcn-ui razrede kot ne ski vmesnik, zato je
// videz usklajen z resničnim programom.
// ============================================================

import {
  ArrowDown,
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  Check,
  LayoutDashboard,
  Package,
  ScanLine,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react"

/* ----------------------------------------------------------------
   Skupni elementi: okvir brskalnika, stranska tipka, poudarjen
   input (glej / vpiši). Zamik poudarka je v "antonovi" točkah.
---------------------------------------------------------------- */

function BrowserFrame({
  url,
  children,
}: {
  url: string
  children: React.ReactNode
}) {
  return (
    <div className="border-white/10 bg-black/30 flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3.5 py-2.5">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="border-white/10 ml-3 flex-1 truncate rounded-md border bg-black/30 px-2.5 py-1 text-[11px] text-white/50">
          {url}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">{children}</div>
    </div>
  )
}

function Sidebar({ labels, active }: { labels: string[]; active: number }) {
  return (
    <div className="hidden w-32 shrink-0 flex-col border-r border-white/10 p-2.5 sm:flex">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="text-[11px] font-bold text-white/80">MARKEC</span>
      </div>
      {labels.map((l, i) => (
        <div
          key={l}
          className={
            i === active
              ? "mb-0.5 flex items-center gap-2 rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white"
              : "mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-white/50"
          }
        >
          <IconDot i={i} />
          {l}
        </div>
      ))}
    </div>
  )
}

function IconDot({ i }: { i: number }) {
  const Icon = [LayoutDashboard, ChartNoAxesCombined, Users, Boxes, Package, ScanLine][i % 6]
  return <Icon className="size-3.5 shrink-0" />
}

/** Poudarjen input: animiran krožec + oznaka "Vpiši" na desni. */
function Field({
  label,
  value,
  highlight = false,
  hint,
  readOnly = false,
}: {
  label: string
  value: string
  highlight?: boolean
  hint?: string
  readOnly?: boolean
}) {
  return (
    <div className={highlight ? "relative pt-4" : ""}>
      {highlight && (
        <>
          <span className="absolute -top-1.5 left-1 animate-ping rounded-full bg-amber-400/60" style={{ width: 10, height: 10 }} />
          <span className="absolute -top-1.5 left-1 rounded-full bg-amber-400" style={{ width: 10, height: 10 }} />
          <span className="absolute -top-1 left-4 -translate-x-1/4 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            {hint ?? "Vpiši sem"}
          </span>
        </>
      )}
      <span className="mb-1 block text-[10px] font-medium text-white/40">{label}</span>
      <div
        className={
          "flex items-center rounded-md border px-2 py-1.5 text-[12px] " +
          (highlight
            ? "border-amber-400 bg-white/10 text-white"
            : "border-white/10 bg-black/30 text-white/70")
        }
      >
        {readOnly ? <Check className="mr-1.5 size-3 text-emerald-400" /> : null}
        <span className="truncate">{value}</span>
        {!readOnly && <span className="ml-auto h-3.5 w-px animate-pulse bg-white/40" />}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xl font-bold leading-none text-white">{value}</div>
      <div className="mt-1.5 text-[10px] font-medium text-white/45">{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold text-white/70">{children}</div>
  )
}

/* ================================================================
   Scene 1 — NADZORNA PLOŠČA (pregled)
   Prikazuje števce dejavnosti + nedavni elementi.
================================================================ */
export function DashboardScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard">
      <Sidebar
        active={0}
        labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]}
      />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <LayoutDashboard className="size-4 text-amber-400" />
          <SectionTitle>Nadzorna plošča</SectionTitle>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Kpi label="Panjske postaje" value="2" />
          <Kpi label="Panji" value="5" />
          <Kpi label="Družine" value="5" />
          <Kpi label="Pregledi" value="12" />
          <Kpi label="V zalogi (koz)" value="36" />
          <Kpi label="Odprta naročila" value="3" />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2.5 pt-4">
          <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3">
            <SectionTitle>Naslednje opravilo</SectionTitle>
            <div className="text-[12px] leading-snug text-white">
              Pregled družine B2 — 16. 6.
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-black">
              <Check className="size-3" /> Prični
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <SectionTitle>Zadnje naročilo</SectionTitle>
            <div className="text-[12px] leading-snug text-white/80">2× Lipov med · 22€</div>
            <div className="mt-1 text-[10px] text-white/50">potrjeno · Anja Kupka</div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ================================================================
   Scene 2 — Vpis nov izdelek (obrazec)
   Glavni prikaz "kako se vpisuje": polja z vzorčnimi vrednostmi.
================================================================ */
export function ProductFormScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard/products/new">
      <Sidebar active={3} labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Package className="size-4 text-amber-400" />
          <SectionTitle>Nov izdelek</SectionTitle>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <Field label="Ime izdelka" value="Cvetlični med 500 g" highlight hint="vpiši ime" />
          <Field label="Cena (€)" value="9,00" />
          <Field label="Kategorija" value="Izdelki" readOnly />
          <Field label="Zaloga (kos)" value="+36" highlight hint="vpiši količino" />
          <div className="col-span-2">
            <Field
              label="Opis"
              value="Odcejen cvetlični med iz lastnih panjskih postaj."
              highlight
              hint="opiši izdelek"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <div className="rounded-md px-3 py-1.5 text-[11px] text-white/60">Prekliči</div>
          <div className="flex items-center gap-1 rounded-md bg-amber-400 px-4 py-2 text-[11px] font-bold text-black">
            Shrani izdelek <ArrowRight className="size-3" />
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ================================================================
   Scene 3 — Stranke (tabela)
================================================================ */
export function CustomersScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard/customers">
      <Sidebar active={2} labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-amber-400" />
            <SectionTitle>Stranke</SectionTitle>
          </div>
          <div className="flex items-center gap-2">
            <Field label="" value="Iskanje…" />
            <div className="rounded-md bg-amber-400 px-3 py-2 text-[11px] font-bold text-black">
              + Nova stranka
            </div>
          </div>
        </div>
        <div className="min-h-0 overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-4 gap-1 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/45">
            <span>Ime</span><span>E-pošta</span><span>Telefon</span><span>Naročila</span>
          </div>
          {[
            ["Anja Kupka", "anja@email.si", "031 222 111", "2"],
            ["Miha Ocvirk", "miha@email.si", "040 333 222", "1"],
            ["Nina Potočnik", "nina@email.si", "051 444 333", "3"],
          ].map((r, ri) => (
            <div
              key={ri}
              className={
                "grid grid-cols-4 items-center gap-1 px-3 py-2.5 text-[11px] " +
                (ri === 0
                  ? "border border-amber-400 bg-amber-400/10 text-white"
                  : "border-b border-white/5 text-white/70 last:border-0")
              }
            >
              <span>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span>
              <span className={ri === 0 ? "text-amber-400" : "text-white/50"}>{r[3]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-white/55">
          Klikni "Nova stranka" ali poišči obstoječo → odpre se njen zapis z naročili.
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ================================================================
   Scene 4 — Pregled čebelarstva (števci + opravila)
================================================================ */
export function ApicultureScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard/apiculture">
      <Sidebar active={4} labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Warehouse className="size-4 text-amber-400" />
          <SectionTitle>Pregled čebelarstva</SectionTitle>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Kpi label="Postaje" value="2" />
          <Kpi label="Panji" value="5" />
          <Kpi label="Družine" value="5" />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
          <div>
            <SectionTitle>Nov pregled družine</SectionTitle>
            <Field label="Družina" value="Družina A1" highlight hint="izberi družino" />
            <div className="mt-2.5">
              <Field label="Ugotovitve" value="V redu" />
            </div>
          </div>
          <div>
            <SectionTitle>Zdravljenje / hranjenje</SectionTitle>
            <Field label="Sredstvo" value="Amitraz" />
            <div className="mt-2.5">
              <Field label="Datum" value="20. 6. 2026" />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <SectionTitle>Zgodovina selitev</SectionTitle>
          <div className="text-[11px] text-white/70">
            Družina B1: Panj B1 → Panj A3 · 12. 6. 2026{" "}
            <Check className="ml-1 inline size-3 text-emerald-400" />
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ================================================================
   Scene 5 — Sledljivost pridelka (serija → izdelek)
================================================================ */
export function TraceabilityScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard/traceability">
      <Sidebar active={5} labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <ScanLine className="size-4 text-amber-400" />
          <SectionTitle>Sledljivost pridelka</SectionTitle>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          <div className="flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-3">
            <ScanLine className="size-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <SectionTitle>Serija — Pridelek 20. 6. 2026</SectionTitle>
              <div className="text-[11px] text-white/75">Postaja: Lipa · Cvetlični med · 18 kg</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-4">
            <span className="h-4 w-px bg-white/15" />
            <ArrowDown className="size-3.5 text-white/40" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <Boxes className="size-4 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <SectionTitle>Izdelek — Cvetlični med 500 g</SectionTitle>
              <div className="text-[11px] text-white/70">+36 kosov iz te serije → v zalogo</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-4">
            <span className="h-4 w-px bg-white/15" />
            <ArrowDown className="size-3.5 text-white/40" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <ShoppingCart className="size-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <SectionTitle>Naročilo — Anja Kupka</SectionTitle>
              <div className="text-[11px] text-white/70">2× Lipov med — povezano s serijo</div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-white/55">
          Vsak kozarec povežeš s serijo in panjsko postajo → stranka vidi, od kod med prihaja.
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ================================================================
   Scene 6 — Analitika / naročila
================================================================ */
export function AnalyticsScene() {
  return (
    <BrowserFrame url="markec.si/s/cebelar/dashboard/analytics">
      <Sidebar active={1} labels={["Nadzorna plošča", "Analitika", "Stranke", "Izdelki", "Evidence", "Sledljivost"]} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <ChartNoAxesCombined className="size-4 text-amber-400" />
          <SectionTitle>Analitika</SectionTitle>
        </div>
        {/* Preprost stolpčni graf */}
        <div className="flex flex-1 items-end gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          {[30, 45, 38, 60, 52, 75, 100].map((h, i) => (
            <div
              key={i}
              className={
                i === 6
                  ? "flex-1 rounded-t bg-amber-400"
                  : "flex-1 rounded-t bg-white/20"
              }
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 pt-3">
          <Kpi label="Prodaja ta mesec" value="214€" />
          <Kpi label="Obisk strani" value="87" />
        </div>
      </div>
    </BrowserFrame>
  )
}