"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { SpinnerIcon, GoogleIcon } from "@/components/icons"
import { toast } from "sonner"
import { Logo } from "@/components/ui/logo"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { useI18n } from "@/lib/i18n/context"
import { getActiveWorkspaceCount } from "@/app/actions/workspaces"
import { resendVerification } from "@/app/actions/auth"

interface LoginFormProps {
  orgName?: string | null
  orgLogo?: string | null
  orgSlug?: string | null
  googleEnabled?: boolean
}

export function LoginForm({ orgName, orgLogo, orgSlug, googleEnabled = false }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  // update() re-fetches the session so the SessionProvider context matches
  // the fresh cookie immediately (cart/checkout read it client-side).
  const { update } = useSession()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  // P2 #74: najemniško označena prijava (?org=) je VRATA STRANKE — iz nje
  // je gost prišel prek "Prijava" v nogi najemnikove strani. Nikoli ne
  // ponujaj provider CTA-ja ("Ustvari svoje podjetje") nekomu, ki kupuje
  // med; pot nazaj je trgovina, ne platforma. Nevtralni /login ostane
  // platformina lastna vrata (obe poti sta tam legitimni, glej #68).
  const isTenantContext =
    Boolean(orgSlug) || Boolean(callbackUrl.startsWith("/s/"))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        // Check if error is about email verification
        if (
          result.code === "EMAIL_NOT_VERIFIED" ||
          result.error.includes("EMAIL_NOT_VERIFIED")
        ) {
          // 2D-5: offer a resend WITHOUT revealing whether the address exists.
          // The server always returns a neutral shape; the UI shows the same
          // "check your inbox" message for success, cooldown or unknown email.
          const resendAction = async () => {
            try {
              await resendVerification({ email: data.email.trim() })
            } catch {
              /* neutral — never reveal account existence */
            }
            toast(t.auth.login.toast.verifyRequired, {
              description: t.auth.login.toast.verifyResent,
              duration: 9000,
            })
          }
          toast(t.auth.login.toast.verifyRequired, {
            description: t.auth.login.toast.verifyDescription,
            duration: 10000,
            action: {
              label: t.auth.login.toast.resend,
              onClick: () => {
                void resendAction()
              },
            },
          })
          return
        }

        // Show generic error for invalid credentials
        toast.error(t.auth.login.toast.loginFailed, {
          description: t.auth.login.toast.invalidCredentials,
        })
        return
      } else {
        // Sync the SessionProvider context BEFORE navigating — without
        // update() client consumers (useSession) stay unauthenticated and
        // flows like the cart would bounce straight back to /login.
        await update()
        toast.success(t.auth.login.toast.loginSuccess, {
          description: t.auth.login.toast.redirecting,
        })

        // F1 #100: uporabnik z več poslovnimi prostori dobi po prijavi
        // vstopno tablo za izbiro. Najemniška callback (trgovina) ni
        // platformina vrata — tam gremo vedno tja, kamor je kazal kupon.
        const isMultiWorkspace =
          !isTenantContext && (await getActiveWorkspaceCount()) > 1
        // NOTE: do NOT call router.refresh() here — it runs synchronously
        // after router.push() and cancels the pending navigation, leaving the
        // user stuck on /login even though the session is authenticated and
        // getActiveWorkspaceCount() succeeded. update() above already
        // re-syncs the client SessionProvider, and the pushed route re-reads
        // the session cookie server-side.
        router.push(isMultiWorkspace ? "/workspaces" : callbackUrl)
      }
    } catch (error) {
      console.log("Login error:", error)
      toast.error(t.auth.login.toast.loginFailed, {
        description: t.auth.login.toast.somethingWrong,
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Logo
              variant="auth"
              src={orgLogo ?? undefined}
              alt={orgName ?? undefined}
            />
            {orgName && orgSlug && (
              <Link
                href={`/s/${orgSlug}`}
                className="text-muted-foreground hover:text-primary-text text-sm transition-colors"
              >
                ← Nazaj v trgovino · {orgName}
              </Link>
            )}
          </div>
          <h1 className="text-center text-2xl font-semibold leading-none tracking-tight">
            {t.auth.login.welcomeBack}
          </h1>
          <CardDescription className="text-center">
            {t.auth.login.signInSubtitle}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {googleEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={() => {
                    void signIn("google", { callbackUrl })
                  }}
                >
                  <GoogleIcon className="mr-2 h-5 w-5" />
                  Nadaljuj z Google
                </Button>
                <div className="relative my-2">
                  <Separator />
                  <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
                    ali z e-pošto
                  </span>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.login.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="ime@primer.si"
                disabled={isSubmitting}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.auth.login.password}</Label>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground hover:text-primary-text text-sm"
                >
                  {t.auth.login.forgotPassword}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                disabled={isSubmitting}
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <SpinnerIcon
                  size={16}
                  weight="bold"
                  className="mr-2 animate-spin"
                />
              )}
              {t.auth.login.signIn}
            </Button>

            <Separator />

            <div className="text-muted-foreground text-center text-sm">
              {t.auth.login.noAccount}{" "}
              <Link
                href="/register"
                className="text-primary-text font-medium hover:underline"
              >
                {t.auth.login.createAccount}
              </Link>
            </div>

            {/* P2 #74: provider CTA izključno v nevtralnem kontekstu —
                najemniška prijava ne sme vabiti gosta k ustvarjanju
                lastnega podjetja. */}
            {!isTenantContext && (
              <div className="text-muted-foreground text-center text-sm">
                {t.auth.login.ownSalon}{" "}
                {/* P2 #68: nevtralni CTA — platforma najema strani vsem obrtom. */}
                <Link
                  href="/start"
                  className="text-primary-text font-medium hover:underline"
                >
                  Ustvari svoje podjetje
                </Link>
              </div>
            )}

            <div className="text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary-text text-sm"
              >
                {t.auth.login.backToHome}
              </Link>
            </div>

            {/* Demo credentials are a DEVELOPMENT aid only. They must never
                render in production — printed admin passwords on a public
                login page let anyone log in (security + professionalism). */}
            {process.env.NODE_ENV !== "production" && (
              <div className="bg-muted text-muted-foreground rounded-lg p-3 text-xs">
                <p className="mb-2 font-semibold">
                  {t.auth.login.demoCredentials}
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-foreground font-medium">
                      {t.auth.login.adminFullAccess}
                    </p>
                    <p>admin@rcbeautysalon.org / admin123</p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      {t.auth.login.staffAccess}
                    </p>
                    <p>laura@rcbeautysalon.org / staff123</p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      {t.auth.login.clientAccess}
                    </p>
                    <p>cliente@rcbeautysalon.org / cliente123</p>
                  </div>
                </div>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
