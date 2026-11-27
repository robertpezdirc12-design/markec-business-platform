// ============================================================
// HERO PREVIEW — produktna vizualija za platformno naslovnico.
//
// Zakaj obstaja: hero je bil na 1280 px en stolpec širine 768,
// desna polovica pa prazna. Namesto izmišljene fotografije ali
// lažnih številk uporabimo copy, ki je v slovarju že bil
// (landing.ts → `mock`, "Ponazoritev vmesnika") in ga doslej ni
// bral noben component.
//
// Je SERVER component: ni JS, ni interakcije. Za bralnik zaslona
// je celota ENA slika (role="img" + aria-label), ne 20 fragmentov
// besedila brez konteksta.
// ============================================================

import { Check } from "lucide-react"

import type { LandingDictionary } from "@/lib/i18n/dict/landing"

export function HeroPreview({ mock }: { mock: LandingDictionary["mock"] }) {
  const done = Math.min(mock.doneCount, mock.tasks.length)
  const pct = Math.round((done / mock.tasks.length) * 100)

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-lg lg:max-w-none">
      {/* Mehka svetloba za kartico — brez slike, samo gradient tokena. */}
      <div
        aria-hidden="true"
        className="from-primary/25 to-accent/25 absolute -inset-4 rounded-[2rem] bg-linear-to-br opacity-50 blur-2xl"
      />

      <div
        role="img"
        aria-label={mock.caption}
        className="border-border/70 bg-card relative overflow-hidden rounded-2xl border shadow-2xl"
      >
        {/* Okvir brskalnika — nakazuje, da gre za resnično stran. */}
        <div className="border-border/60 bg-muted/40 flex items-center gap-1.5 border-b px-3.5 py-2.5">
          <span className="bg-destructive/40 size-2.5 rounded-full" />
          <span className="bg-accent/50 size-2.5 rounded-full" />
          <span className="bg-primary/40 size-2.5 rounded-full" />
          <span className="border-border/60 text-muted-foreground bg-background/70 ml-2 min-w-0 flex-1 truncate rounded-md border px-2.5 py-1 text-[11px]">
            {mock.url}
          </span>
        </div>

        <div className="flex min-h-0">
          {/* Stranska vrstica nadzorne plošče */}
          <div className="border-border/60 bg-muted/20 hidden w-28 shrink-0 flex-col gap-0.5 border-r p-2 sm:flex">
            <span className="text-primary-text px-1.5 pb-2 text-[10px] font-bold tracking-wider">
              {mock.brand}
            </span>
            {mock.side.map((item, i) => (
              <span
                key={item}
                className={
                  i === 0
                    ? "bg-background text-foreground rounded-md px-1.5 py-1 text-[11px] font-semibold shadow-sm"
                    : "text-muted-foreground rounded-md px-1.5 py-1 text-[11px]"
                }
              >
                {item}
              </span>
            ))}
          </div>

          {/* Vsebina: vodena namestitev */}
          {/* pb-* pušča prostor, da mini kartica spodaj ne prekrije opravil. */}
          <div className="min-w-0 flex-1 p-3.5 pb-16 sm:p-4 sm:pb-20">
            <p className="text-sm font-semibold">{mock.title}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {mock.progress}
            </p>
            <div
              className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>

            <ul className="mt-3 space-y-1.5">
              {mock.tasks.map((task, i) => {
                const isDone = i < done
                return (
                  <li
                    key={task}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className={
                        isDone
                          ? "bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full"
                          : "border-border flex size-4 shrink-0 items-center justify-center rounded-full border"
                      }
                    >
                      {isDone ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span
                      className={
                        isDone
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }
                    >
                      {task}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Rezultat: mini stran podjetja, ki se "odklopi" od plošče. */}
      <div className="border-border/70 bg-card relative -mt-8 ml-auto w-[86%] rounded-xl border p-3 shadow-xl sm:-mt-10 sm:w-[78%]">
        <span className="text-[11px] font-semibold">{mock.miniName}</span>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10px]">
          <span className="bg-primary size-1.5 shrink-0 rounded-full" />
          {mock.mini}
        </p>
        <span className="bg-primary text-primary-foreground mt-2 inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold">
          {mock.miniCta}
        </span>
      </div>

      {/* Vidni podpis je enak aria-label-u zgoraj — skrijemo ga pred
          bralnikom zaslona, da se ne prebere dvakrat. */}
      <p
        aria-hidden="true"
        className="text-muted-foreground mt-3 text-center text-[11px]"
      >
        {mock.caption}
      </p>
    </div>
  )
}
