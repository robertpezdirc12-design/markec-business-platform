import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import { auth } from "@/lib/auth/auth"
import { resolveActiveOrganizationId } from "@/lib/auth/memberships"
import { getSessionOrg } from "@/lib/tenant"
import { getServerI18n } from "@/lib/i18n/server"
import { ModulesOverview } from "@/components/dashboard/modules-overview"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Nastavitev modulov | Dashboard",
}

export default async function DashboardSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/setup")

  // Ensure we have a resolvable active organization; if not, try self-service
  // flow entry (handles auto-create / workspace picker).
  const activeOrgId = await resolveActiveOrganizationId(
    session.user.id,
    session.user.organizationId ?? null
  )
  if (!activeOrgId) {
    redirect("/self-service")
  }

  const [org, params, { locale }] = await Promise.all([
    getSessionOrg(),
    searchParams,
    getServerI18n(),
  ])
  const en = locale === "en"
  const isWelcome = params.welcome === "1"

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {isWelcome ? <Sparkles className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {isWelcome
                  ? en
                    ? "Your business workspace is ready"
                    : "Vaš poslovni prostor je pripravljen"
                  : en
                    ? "Choose and enable modules"
                    : "Izbira in vklop modulov"}
              </CardTitle>
              <CardDescription className="text-sm">
                {org ? (
                  <>
                    {en ? "Organization " : "Organizacija "}
                    <span className="font-medium text-foreground">{org.name}</span>
                    {en ? " is selected. " : " je izbrana. "}
                  </>
                ) : null}
                {en
                  ? "Choose which modules you want to use. Required modules are always included; you can enable or disable the others any time — data is never deleted when you turn a module off."
                  : "Izberite, katere module želite uporabljati. Obvezni moduli so vedno vključeni, ostale lahko vklopite ali izklopite kadarkoli — podatki se pri izklopu ne izbrišejo."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {en
              ? "After setting up modules you can continue to the dashboard or refine the detailed settings."
              : "Po nastavitvi modulov lahko nadaljujete na nadzorno ploščo ali uredite podrobnejše nastavitve."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">
                {en ? "Detailed settings" : "Podrobne nastavitve"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">
                {en ? "Continue to dashboard" : "Nadaljuj na nadzorno ploščo"}{" "}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ModulesOverview />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {en ? "Next steps" : "Naslednji koraki"}
          </CardTitle>
          <CardDescription>
            {en
              ? "You can change modules any time in settings. We also recommend completing your business profile."
              : "Module lahko kadarkoli spremenite v nastavitvah. Priporočamo tudi, da dopolnite profil podjetja."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard">{en ? "Open dashboard" : "Odpri nadzorno ploščo"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings">
              {en ? "Edit profile and settings" : "Uredi profil in nastavitve"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
