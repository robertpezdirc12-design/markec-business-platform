"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  DashboardScene,
  ProductFormScene,
  CustomersScene,
  ApicultureScene,
  TraceabilityScene,
  AnalyticsScene,
} from "@/components/landing/demo-tour-scenes"

/** Izriše navidezen prikaz vmesnika (scene) ali sliko, če scene ni. */
function SceneView({
  scene,
  image,
  alt,
}: {
  scene?: string
  image?: string
  alt?: string
}) {
  switch (scene) {
    case "dashboard":
      return <DashboardScene />
    case "product-form":
      return <ProductFormScene />
    case "customers":
      return <CustomersScene />
    case "apiculture":
      return <ApicultureScene />
    case "traceability":
      return <TraceabilityScene />
    case "analytics":
      return <AnalyticsScene />
    default: {
      if (!image) return null
      return (
        <div className="border-white/10 bg-white/5 overflow-hidden rounded-xl border">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="border-white/10 ml-2 rounded-md border px-2 py-0.5 text-[11px] text-white/40">
              markec.si/s/cebelar
            </span>
          </div>
          <div className="relative h-64 w-full sm:h-72 md:h-80">
            <Image
              src={image}
              alt={alt ?? ""}
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      )
    }
  }
}

// ============================================================
// DEMO TOUR — "video" predstavitev programa, ki se odpre na klik.
//
// Odpre celozaslonski pregled, ki se sama vrti po korakih (kot
// video posnetek): vsak korak prikaže pravi zaslon programa (ali
// panogo primerne slike) tule s kratkim opisom, kaj lahko lastnik
// počne. Obiskovalec lahko kadarkoli premakne Naprej/Nazaj ali
// ustavi samodejno predvajanje — brez prijave.
//
// Podatki tur (slike + besedilo) pridejo kot props iz strežniške
// komponente (lokalizirano prek i18n slovarja).
// ============================================================

export interface DemoStep {
  /** ID koraka, uporabljen kot key. */
  id: string
  /** Sekunde, koliko časa ob samodejnem predvajanju ostane korak. */
  seconds: number
  /** URL slike — uporabljen samo, ko korak nima scene. */
  image?: string
  alt?: string
  /** Navidezen prikaz vmesnika (nadzorna plošča, obrazec, tabela …). */
  scene?: string
  title: string
  description: string
}

interface DemoStepRaw {
  /** Sekunde, koliko časa ob samodejnem predvajanju ostane korak. */
  seconds: number
  image?: string
  alt?: string
  scene?: string
  title: string
  description: string
}

export interface DemoTourProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vertical: string
  accent: string
  stepsRaw: DemoStepRaw[]
}

/**
 * Klientov gumb, ki odpre tur. Server komponenta (landing) mu preda zgolj
 * serijalizljive podatke (label + steps) — stanje odprtosti živi tu znotraj.
 */
export function DemoTourButton({
  vertical,
  accent,
  label,
  stepsRaw,
  variant = "solid",
  className,
}: {
  vertical: string
  accent: string
  label: string
  stepsRaw: DemoStepRaw[]
  /** "solid" = primaren gumb, "outline" = tih obrisni gumb. */
  variant?: "solid" | "outline"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const base =
    variant === "outline"
      ? "border-border text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-md border bg-transparent px-5 py-2.5 text-sm font-semibold transition"
      : "bg-primary text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} ${className ?? ""}`}
      >
        <Play className="size-4" aria-hidden="true" />
        {label}
      </button>
      <DemoTour
        open={open}
        onOpenChange={setOpen}
        vertical={vertical}
        accent={accent}
        stepsRaw={stepsRaw}
      />
    </>
  )
}

export function DemoTour({ open, onOpenChange, vertical, accent, stepsRaw }: DemoTourProps) {
  const steps = React.useMemo<DemoStep[]>(
    () => stepsRaw.map((s, i) => ({ id: `${vertical}-${i}`, ...s })),
    [stepsRaw, vertical]
  )
  const [index, setIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(true)

  // Reset ob vsakem odprtju (začnemo od začetka, predvajamo). Nastavljamo med
  // izrisom po uradnem vzorcu »prilagodi stanje ob spremembi propa« — tako ni
  // vmesnega izrisa s starim indeksom.
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setIndex(0)
      setPlaying(true)
    }
  }

  const count = steps.length
  const current = steps[Math.min(index, count - 1)]

  // Samodejno predvajanje: po seconds ob posameznem koraku preskoči naprej;
  // na koncu se ustavi (ne zanka).
  React.useEffect(() => {
    if (!open || !playing) return
    const delay = current?.seconds != null ? current.seconds * 1000 : 4000
    const t = window.setTimeout(() => {
      setIndex((i) => {
        if (i < count - 1) return i + 1
        setPlaying(false)
        return i
      })
    }, delay)
    return () => window.clearTimeout(t)
  }, [open, playing, index, current, count])

  const goNext = React.useCallback(() => {
    setIndex((i) => (i < count - 1 ? i + 1 : i))
    setPlaying(true)
  }, [count])
  const goBack = React.useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i))
    setPlaying(true)
  }, [])

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  // Tipkovnica: levo/desno → prejšnji/naslednji, Escape → zapri (Radix to naredi sam).
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goBack()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, goNext, goBack])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-50" />
        <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 flex max-h-[88vh] w-full max-w-6xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border-0 bg-black/95 text-white sm:rounded-2xl">
        <DialogTitle className="sr-only">{current?.title}</DialogTitle>
        <DialogDescription className="sr-only">{current?.description}</DialogDescription>
        {/* AT: stalna živa regija — ob napredovanju/avtopredvajanju bralnik
            napove trenutni korak (WCAG 4.1.3). Pravo časovno prostor vrednot. */}
        <p role="status" aria-live="polite" className="sr-only">
          {current
            ? `Korak ${index + 1} od ${count}: ${current.title}`
            : ""}
        </p>

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: accent }}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
            Demo · {vertical.charAt(0).toUpperCase() + vertical.slice(1)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Ustavi predvajanje" : "Predvajaj"}
              className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Zapri"
              className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body — scene vmesnika ali slika + besedilo */}
        {current ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.6fr_1fr]">
            {/* Navidezen prikaz vmesnika (scene) ali slika */}
            <div className="relative order-2 min-h-0 overflow-hidden bg-black p-4 md:order-1 md:p-6">
              <div className="h-full">
                <SceneView scene={current.scene} image={current.image} alt={current.alt} />
              </div>
            </div>

            {/* Besedilo koraka */}
            <div className="order-1 flex min-h-0 flex-col justify-center gap-4 overflow-y-auto p-6 md:order-2 md:px-10 md:py-8">
              <div className="flex items-center">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setIndex(i)
                      setPlaying(true)
                    }}
                    aria-label={i === index ? `Korak ${i + 1} od ${count}` : `Pojdi na korak ${i + 1}`}
                    className="flex h-6 w-7 items-center justify-center rounded-md"
                  >
                    <span
                      className="block h-1.5 rounded-full transition-[width,background-color]"
                      style={{
                        width: i === index ? "1.25rem" : "0.5rem",
                        backgroundColor: i === index ? accent : "rgba(255,255,255,0.35)",
                      }}
                    />
                  </button>
                ))}
              </div>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {current.title}
              </h3>
              <p className="text-white/70 text-sm leading-relaxed sm:text-base">
                {current.description}
              </p>

              <div className="mt-auto flex items-center justify-between pt-6">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={index === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 min-h-10 text-sm font-medium text-white/70 transition hover:text-white disabled:opacity-30"
                >
                  <ArrowLeft className="size-4" /> Nazaj
                </button>
                {index < count - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: "#ffffff", color: "#92400e" }}
                  >
                    Naprej <ArrowRight className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: "#ffffff", color: "#92400e" }}
                  >
                    Začni svojega <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Spodnja kazalna črta ob samodejnem predvajanju */}
        <div className="h-1 w-full bg-white/10">
          <div
            key={index}
            className="h-full transition-[width]"
            style={{ backgroundColor: accent }}
          />
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}