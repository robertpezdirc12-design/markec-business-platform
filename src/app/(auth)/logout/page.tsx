import type { Metadata } from "next"
import Link from "next/link"
import { signOut } from "@/lib/auth/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Odjava | Poslovna platforma",
  description: "Varno se odjavite iz svojega računa.",
  robots: { index: false, follow: false },
}

/**
 * P1 #107 — SLOVENSKA STRAN ZA ODJAVO.
 *
 * NextAuth ima vgrajeno potrditveno stran za odjavo (`/api/auth/signout`),
 * ki je Angleška ("Sign out") in je ni mogoče prevesti. Z `pages.signOut`
 * v `auth.config.ts` vse poti, ki vodijo na to stran, pristanejo tukaj.
 *
 * Odjava je POST (server action), ne GET: povezava, ki odjavi že ob
 * obisku, je ranljiva (predpomnjenje/prefetch v brskalniku lahko odjavi
 * uporabnika brez njegove odločitve).
 */
export default function LogoutPage() {
  async function logout() {
    "use server"
    await signOut({ redirectTo: "/" })
  }

  return (
    <main className="from-muted/40 via-background to-muted/20 flex min-h-screen items-center justify-center bg-linear-to-b px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Odjava</CardTitle>
          <CardDescription>
            Ste prepričani, da se želite odjaviti? Vaša košarica in
            rezervacije ostanejo shranjene.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form action={logout}>
            <Button type="submit" className="w-full">
              Da, odjavi me
            </Button>
          </form>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/">Ne, ostani prijavljen</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
