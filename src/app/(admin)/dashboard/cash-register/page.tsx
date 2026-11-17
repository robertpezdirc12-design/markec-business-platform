import { requirePagePermission } from "@/lib/auth/guards"
import { getSessionOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { getServerI18n } from "@/lib/i18n/server"
import { getCashRegisterState } from "@/app/actions/cash-register"
import { CashRegisterClient } from "@/components/admin/cash-register/cash-register-client"

// ============================================================
// BLAGAJNA (WP-1) — dnevna denarna seja
//
// Modul je capability `cashRegister` (profil dejavnosti določi, ali je
// obvezen ali izbiren); ko je izklopljen, stran vrne jasno sporočilo
// namesto prazne tabele. Pravica: orders.manage (prodaje so naročila).
// ============================================================

export default async function CashRegisterPage() {
  await requirePagePermission("orders.manage")
  const [{ t, locale }, org] = await Promise.all([getServerI18n(), getSessionOrg()])

  const enabled = org
    ? isCapabilityEnabled(resolveEffectiveProfile(org), "cashRegister")
    : false

  if (!enabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.common.cashRegister.title}
        </h1>
        <p className="text-muted-foreground max-w-prose">
          {t.common.cashRegister.disabledHint}
        </p>
      </div>
    )
  }

  const state = await getCashRegisterState()
  const labels = {
    ...t.common.cashRegister,
    errors: {
      GENERIC: t.common.cashRegister.errors.generic,
      VALIDATION: t.common.cashRegister.errors.validation,
      INVALID_AMOUNT: t.common.cashRegister.errors.invalidAmount,
      ALREADY_OPEN: t.common.cashRegister.errors.alreadyOpen,
      NO_OPEN_SESSION: t.common.cashRegister.errors.noOpenSession,
      SESSION_CLOSED: t.common.cashRegister.errors.sessionClosed,
      SESSION_NOT_OPEN: t.common.cashRegister.errors.sessionClosed,
      NOT_FOUND: t.common.cashRegister.errors.notFound,
      ONLINE_NOT_SUPPORTED: t.common.cashRegister.errors.onlineNotSupported,
      CUSTOMER_NOT_FOUND: t.common.cashRegister.errors.customerNotFound,
    },
  }

  return <CashRegisterClient state={state} labels={labels} locale={locale} />
}
