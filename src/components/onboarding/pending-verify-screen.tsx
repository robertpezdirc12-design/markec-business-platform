"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { resendVerification } from "@/app/actions/auth"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckCircleIcon } from "@/components/icons/check-circle-icon"
import { CopyIcon } from "@/components/icons/copy-icon"

/**
 * 2D-4 — po uspešnem ustvarjanju podjetja (anonimni lastnik) račun ni več
 * samodejno verificiran. Ta zaslon uporabnika pošlje v aktivacijski tok:
 *  • brez e-poštnega servisa prikaže verifikacijsko povezavo neposredno
 *    (iskreno — ne izmišljamo dostave),
 *  • sicer napoti na preverjanje e-pošte + omogoči varen ponovni posljetek.
 */
export function PendingVerifyScreen({
  slug,
  verificationUrl,
  email,
  onDone,
}: {
  slug: string
  verificationUrl: string | null
  email: string
  onDone: () => void
}) {
  const [resending, setResending] = useState(false)

  async function handleResend() {
    if (resending) return
    setResending(true)
    try {
      const res = await resendVerification({ email })
      setResending(false)
      const verify = res as { verificationUrl?: string }
      if (verify.verificationUrl) {
        toast.success("Nova povezava je pripravljena.", {
          description: "Uporabite jo za potrditev računa.",
        })
      } else if ((res as { ignored?: boolean }).ignored) {
        // Cooldown ali neznan/že-verificiran naslov — ne razkrijemo jih,
        // pokažemo le nevtralno, iskreno sporočilo.
        toast.info("Poskusite čez nekaj trenutkov.", {
          description: "Nedavno smo vam že poslali potrditveno sporočilo.",
        })
      } else {
        toast.success("Potrditveno sporočilo je bilo poslano.", {
          description: `Preverite svoj e-poštni predal (${email}).`,
        })
      }
    } catch {
      setResending(false)
      toast.error("Ponovnega pošiljanja ni bilo mogoče izvesti.")
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" aria-label="Na začetno stran">
            <Logo variant="navbar" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 items-start px-4 py-10 sm:items-center">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="flex justify-center">
              <CheckCircleIcon size={64} weight="fill" className="text-green-500" />
            </div>
            <CardTitle className="text-center text-2xl">Podjetje je ustvarjeno!</CardTitle>
            <CardDescription className="text-center">
              Vaša stran je na voljo na <span className="font-medium">/s/{slug}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {verificationUrl ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Za dokončanje aktivacije sledite tej povezavi in potrdite svoj e-poštni
                  naslov. Po potrditvi se prijavite s svojo e-pošto in geslom.
                </p>
                <div className="rounded-lg border border-dashed p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Povezava za potrditev (testno okolje)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                      {verificationUrl}
                    </code>
                    <button
                      type="button"
                      aria-label="Kopiraj povezavo"
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-xs transition hover:bg-muted"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `${window.location.origin}${verificationUrl}`
                        )
                        toast.success("Povezava je kopirana.")
                      }}
                    >
                      <CopyIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Poslali smo vam potrditveno e-pošto. Kliknite povezavo v sporočilu, da
                  aktivirate račun, nato se prijavite s svojo e-pošto in geslom.
                </p>
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Poslano na
                  </span>
                  <span className="break-all font-medium" data-testid="verify-recipient">
                    {email}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ni v predalu? Preverite mapo »Neželena pošta« ali uporabite gumb spodaj za
                  ponovno pošiljanje.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {!verificationUrl && (
              <Button variant="outline" className="w-full" onClick={handleResend} disabled={resending}>
                {resending ? "Pošiljam …" : "Ponovno pošlji potrditveno povezavo"}
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={onDone}>
              Prijava
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}