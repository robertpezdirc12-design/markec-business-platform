"use client"

import { useEffect, useState, useActionState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import {
  buildBookingSchema,
  buildAuthenticatedBookingSchema,
} from "@/lib/validations/booking"
import {
  createCheckoutSession,
  createGuaranteeCheckoutSession,
  getBookingGuaranteeOptions,
} from "@/app/actions/stripe"
import {
  trackBookingView,
  trackBookingConversion,
} from "@/app/actions/ab-tracking"
import {
  NO_SHOW_CONSENT_LABEL,
  NO_SHOW_POLICY_TEXT,
} from "@/lib/booking/no-show-policy"
import {
  createAppointment,
  getIntakeFormForService,
  listBookingResources,
  type BookingResource,
} from "@/app/actions/appointments"
import { ServiceStep } from "./steps/service-step"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/context"
import { checkPromotionCode } from "@/app/actions/checkout-promo"
// F2.2.2 P0-2: gostova rezervacija brez plačila se vrne na uspešno stran
// ZA NAJEMNIKA (isto površino, na kateri je oddal obrazec) — gola pot
// /booking/success bi padla na platformo in izgubila najemnika (enaka
// napaka kot Stripe success_url, popravljen v actions/stripe.ts).
import { useOrgPrefix } from "@/lib/org-path-hooks"
import { ServiceSelectionStep } from "./steps/service-selection-step"
import { StaffStep } from "./steps/staff-step"
import { StaffDisplayStep } from "./steps/staff-display-step"
import { DateTimeStep } from "./steps/date-time-step"
import { CustomerInfoStep } from "./steps/customer-info-step"
import { BookingSummaryCard } from "./booking-summary-card"
import { BookingStepper } from "./booking-stepper"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SparkleIcon } from "@/components/icons"
import { format, isSameDay } from "date-fns"
import {
  fdStr,
  fdOptStr,
  zodIssuesToFieldErrors,
} from "@/lib/forms/form-data"

import { BookingFormProps, BookingFormValues } from "@/lib/interfaces"

// NN/g "error recovery": po neuspelem submitu premaknemo fokus na prvo
// polje z napako (`aria-invalid="true"`), da uporabnik s tipkovnico in
// bralnikom ekrana takoj ve, kje mora popraviti (WCAG 2.4.3 / 3.3.1).
function focusFirstFormError() {
  // nežen requestAnimationFrame, da se aria-invalid slike z errorjem odrenderajo
  requestAnimationFrame(() => {
    const first = document.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-error="true"]'
    )
    if (first) {
      first.focus({ preventScroll: false })
      first.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  })
}

export function BookingForm(props: BookingFormProps) {
  const {
    salonConfig,
    isAuthenticated,
    isEmployee,
    paymentsEnabled = true,
    defaultValues = {},
    abVariant = "full",
    organizationId = "",
  } = props
  const { locale, t, withBusiness } = useI18n()
  // F2.2.2 P0-2: najemniška pripona za client-side režime (push na uspešno
  // stran brez plačila). "" na golih poteh (custom domena servi golo).
  const tenantPrefix = useOrgPrefix()

  // A/B runtime //xeno: ob prvem nalaganju forme zabeleži VIEW dogodek
  // v varianti (za dash metric konverzije). Enkrat na mount; ognjena
  // stran se NE šteje kot konverzija — to se zgodi ob dejanskem submitu.
  useEffect(() => {
    if (organizationId) {
      void trackBookingView({ organizationId, variant: abVariant }).catch(
        () => {}
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, abVariant])

  const router = useRouter()
  const [flowError, setFlowError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  // E2-7 (G7): optional workspace resources (empty for non-capable orgs —
  // the selector then never renders).
  const [resources, setResources] = useState<BookingResource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  // #92: izbrani dodatki (ID-ji) — cene/trajanje razreši strežnik iz DB.
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const availableAddons = props.addons ?? []
  const selectedAddons = availableAddons.filter((a) => selectedAddonIds.includes(a.id))
  const addonDurationMin = selectedAddons.reduce((s, a) => s + a.durationMin, 0)
  // #96: sprejemni obrazec storitve (service-first) + odgovori.
  const [intakeForm, setIntakeForm] = useState<
    | {
        name: string
        description: string | null
        fields: {
          key: string
          label: string
          type: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
          required: boolean
          options?: string[]
          placeholder?: string
          unit?: string
        }[]
      }
    | null
  >(null)
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})

  // #97 (AD-07): no-show zaščita — izbira načina pologa (plačaj zdaj
  // prek Checkouta ali garancija s kartico). Na voljo samo ko najemnik
  // ima Stripe ključ in polog > 0 (javna poglednica z akcije).
  const [guarantee, setGuarantee] = useState<{
    available: boolean
    depositAmount: number
    currency: string
  }>({ available: false, depositAmount: 0, currency: "EUR" })
  const [paymentMode, setPaymentMode] = useState<"deposit" | "guarantee">("deposit")
  const [noShowConsent, setNoShowConsent] = useState(false)
  // F5.1: promocijska koda (neobvezna; preveri se ob rezervaciji).
  const [promotionCode, setPromotionCode] = useState("")
  // F5.1 UX: sprotna preverba veljavnosti (gumb "Preveri").
  type PromoState = { ok: boolean; message?: string } | null
  const [promotionState, setPromotionState] = useState<PromoState>(null)
  const [isCheckingPromo, startCheckPromo] = useTransition()

  const handleCheckPromotionCode = () => {
    if (!promotionCode.trim()) return
    startCheckPromo(async () => {
      const r = await checkPromotionCode(promotionCode)
      setPromotionState(
        r.ok
          ? { ok: true, message: `${r.name} · ${r.discountLabel}` }
          : { ok: false, message: r.message }
      )
    })
  }




  useEffect(() => {
    let cancelled = false
    listBookingResources()
      .then((res) => {
        if (!cancelled) setResources(res)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Determine mode
  const isStaffFirst = props.mode === "staff-first"

  // Get the selected service based on mode
  const getSelectedService = () => {
    if (isStaffFirst) {
      return props.staffServices.find((s) => s.id === selectedServiceId)
    }
    return props.service
  }

  const selectedService = getSelectedService()

  const serviceIdForIntake = isStaffFirst ? selectedServiceId : props.mode === "service-first" ? props.service.id : ""
  useEffect(() => {
    let cancelled = false
    if (!serviceIdForIntake) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntakeForm(null)
      return
    }
    getIntakeFormForService(serviceIdForIntake)
      .then((form) => {
        if (!cancelled) setIntakeForm(form)
      })
      .catch(() => {
        if (!cancelled) setIntakeForm(null)
      })
    return () => {
      cancelled = true
    }
  }, [serviceIdForIntake])

  useEffect(() => {
    let cancelled = false
    if (!serviceIdForIntake) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGuarantee({ available: false, depositAmount: 0, currency: "EUR" })
      return
    }
    getBookingGuaranteeOptions([serviceIdForIntake])
      .then((opts) => {
        if (!cancelled) setGuarantee(opts)
      })
      .catch(() => {
        if (!cancelled)
          setGuarantee({ available: false, depositAmount: 0, currency: "EUR" })
      })
    return () => {
      cancelled = true
    }
  }, [serviceIdForIntake])

  // Use appropriate schema based on authentication status — locale-aware
  // factory keeps validation messages in the visitor's language.
  const schema = isAuthenticated
    ? buildAuthenticatedBookingSchema(locale)
    : buildBookingSchema(locale)

  const {
    control,
    setValue,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<BookingFormValues>({
    mode: "onChange",
    defaultValues: {
      staffId: isStaffFirst ? props.preselectedStaff.id : "",
      date: undefined,
      time: "",
      firstName: defaultValues.firstName || "",
      lastName: defaultValues.lastName || "",
      email: defaultValues.email || "",
      phone: defaultValues.phone ?? "",
      notes: "",
      vehiclePlate: "",
      vehicleName: "",
    },
  })

  // useWatch is more compatible with React Compiler than watch()
  const staffId = useWatch({ control, name: "staffId" })
  const selectedDate = useWatch({ control, name: "date" })
  const selectedTime = useWatch({ control, name: "time" })
  const customerValues = {
    firstName: useWatch({ control, name: "firstName" }) ?? "",
    lastName: useWatch({ control, name: "lastName" }) ?? "",
    email: useWatch({ control, name: "email" }) ?? "",
    phone: useWatch({ control, name: "phone" }) ?? "",
    notes: useWatch({ control, name: "notes" }) ?? "",
    vehiclePlate: useWatch({ control, name: "vehiclePlate" }) ?? "",
    vehicleName: useWatch({ control, name: "vehicleName" }) ?? "",
  }
  // P1 #9 (audit-2026-11): inline validation for the controlled customer
  // fields. These inputs are intentionally unregistered (React 19 action
  // reset workaround), so RHF's `trigger()` is a no-op for them — the
  // single-field check runs the SAME zod schema slice the server uses.
  type CustomerField = "firstName" | "lastName" | "email" | "phone"
  const validateCustomerField = (field: CustomerField) => {
    // zod 4.6: `pick()` zahteva tipizirano masko; polje beremo neposredno iz
    // `shape` — enaka validacija, brez tipskega obvoza.
    const fieldSchema = schema.shape[field]
    const result = fieldSchema.safeParse(getValues(field))
    if (result.success) {
      clearErrors(field)
    } else {
      const message = result.error.issues[0]?.message
      if (message) setError(field, { type: "validation", message })
    }
  }
  const setCustomerField = (
    field: keyof typeof customerValues,
    value: string
  ) => {
    setValue(field, value)
    // Don't nag while typing: only re-validate a field that already shows
    // an error, so it clears the moment the value becomes valid. The old
    // unconditional clearErrors() also wiped blur/submit errors.
    if (errors[field]) validateCustomerField(field as CustomerField)
  }

  // Handle service selection in staff-first mode
  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId)
  }

  // Submit — React 19 `action={}` pathway (F1: E3-8 follow-up).
  // All fields are controlled (or carried by hidden inputs), so the
  // framework's automatic post-action form reset cannot lose user input.
  // Validation runs against the SAME schema the resolver used; issues map
  // to the same inline error slots. Server actions stay unchanged.
  const [, formAction, isPending] = useActionState(
    async (_prev: { ok: boolean } | null, formData: FormData) => {
      if (isStaffFirst && !selectedServiceId) {
        setFlowError("Izberite storitev")
        return { ok: false }
      }

      setFlowError(null)

      const rawDate = fdStr(formData, "date")
      if (!rawDate) {
        setFlowError("Izberite datum")
        // Global feedback: the inline summary error is easy to miss when the
        // submit button is off-screen (mobile) — toast regardless.
        toast.error("Izberite termin pred potrditvijo.")
        return { ok: false }
      }

      // "yyyy-MM-dd" (salon-local) → the same local-midnight Date the
      // picker produced, so the schema's z.date() validates identically.
      const [y, m, d] = rawDate.split("-").map(Number)
      const parsedValues = {
        staffId: fdStr(formData, "staffId"),
        date: new Date(y, m - 1, d),
        time: fdStr(formData, "time"),
        firstName: fdStr(formData, "firstName"),
        lastName: fdStr(formData, "lastName"),
        email: fdStr(formData, "email"),
        phone: fdStr(formData, "phone"),
        notes: fdOptStr(formData, "notes"),
        vehiclePlate: fdOptStr(formData, "vehiclePlate") || undefined,
        vehicleName: fdOptStr(formData, "vehicleName") || undefined,
      }

      // Missing staff: keep the inline StaffStep error (same message as the
      // schema) AND toast, so the failure is visible next to the button too.
      if (!parsedValues.staffId) {
        setError("staffId", { message: t.booking.staffRequired })
        toast.error(t.booking.staffRequiredToast)
        focusFirstFormError()
        return { ok: false }
      }

      const parsed = schema.safeParse(parsedValues)
      if (!parsed.success) {
        const fieldErrors = zodIssuesToFieldErrors(parsed.error)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof BookingFormValues, { message })
        }
        // #112-2: validacijska napaka mora biti VIDNA — prej je bil toast
        // odstranjen (TEMP-DEBUG) in skrita polja (telefon v zaposlenem
        // načinu) so padla tiho.
        toast.error(parsed.error.issues[0]?.message ?? t.booking.checkoutFailed)
        focusFirstFormError()
        return { ok: false }
      }

      const serviceId = isStaffFirst ? selectedServiceId : props.service.id
      const bookingDate = rawDate
      const bookingTime = parsed.data.time

      try {
        // Employee flow: Create appointment directly (no Stripe payment required)
        if (isEmployee) {
          const result = await createAppointment({
            serviceIds: [serviceId],
            staffId: parsed.data.staffId,
            startTime: new Date(),
            bookingDate,
            bookingTime,
            guestPhone: parsed.data.phone || undefined,
            notes: parsed.data.notes || undefined,
            isEmployee: true, // Apply 20% discount, no deposit
            resourceRecordId: selectedResourceId,
            addonIds: selectedAddonIds,
          intakeAnswers,
          promotionCode: promotionCode.trim() || undefined,
          })

          if (result.success && result.appointmentId) {
            // A/B: zabeleži konverzijo (oddan termin) — samo za dashboard.
            if (organizationId) {
              void trackBookingConversion({
                organizationId,
                variant: abVariant,
                appointmentId: result.appointmentId,
              }).catch(() => {})
            }
            router.push(`/my-appointments?new=${result.appointmentId}`)
            return { ok: true }
          }
          const employeeError =
            result.error || t.booking.employeeCreateFailed
          setFlowError(employeeError)
          toast.error(employeeError)
          return { ok: false }
        }

        // #97 (AD-07): garancija s kartico — brez privolitve ni garancije.
        if (paymentMode === "guarantee") {
          if (!noShowConsent) {
            const consentError = withBusiness(
              "Za no-show zaščito je obvezna privolitev — izberite plačilo pologa zdaj."
            )
            setFlowError(consentError)
            toast.error(consentError)
            return { ok: false }
          }
          const guaranteeResult = await createGuaranteeCheckoutSession({
            serviceIds: [serviceId],
            staffId: parsed.data.staffId,
            startTime: new Date(),
            bookingDate,
            bookingTime,
            resourceRecordId: selectedResourceId,
            addonIds: selectedAddonIds,
            intakeAnswers,
            promotionCode: promotionCode.trim() || undefined,
            guestName: !isAuthenticated
              ? `${parsed.data.firstName} ${parsed.data.lastName}`
              : undefined,
            guestEmail: !isAuthenticated ? parsed.data.email : undefined,
            guestPhone: parsed.data.phone || undefined,
            notes: parsed.data.notes || undefined,
          })
          if (guaranteeResult.success && guaranteeResult.checkoutUrl) {
            window.location.assign(guaranteeResult.checkoutUrl)
            return { ok: true }
          }
          const gError =
            guaranteeResult.error || t.booking.checkoutFailed
          setFlowError(gError)
          toast.error(gError)
          return { ok: false }
        }

        // Regular customer flow: Stripe Checkout, then redirect to payment
        const result = await createCheckoutSession({
          serviceIds: [serviceId],
          staffId: parsed.data.staffId,
          startTime: bookingDate, // legacy field — server prefers bookingDate/bookingTime
          bookingDate,
          bookingTime,
          resourceRecordId: selectedResourceId,
          addonIds: selectedAddonIds,
          intakeAnswers,
          promotionCode: promotionCode.trim() || undefined,
          guestName: !isAuthenticated
            ? `${parsed.data.firstName} ${parsed.data.lastName}`
            : undefined,
          guestEmail: !isAuthenticated ? parsed.data.email : undefined,
          guestPhone: parsed.data.phone || undefined,
          notes: parsed.data.notes || undefined,
        })

        if (result.success && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl)
          return { ok: true }
        }

        // Payments are an optional salon integration (E4-3b). When the salon
        // has no Stripe key, checkout cannot collect the deposit — fall back
        // to a PENDING appointment the salon confirms manually, instead of
        // blocking the booking entirely.
        if (result.paymentRequired) {
          const fallback = await createAppointment({
            serviceIds: [serviceId],
            staffId: parsed.data.staffId,
            startTime: new Date(),
            bookingDate,
            bookingTime,
            guestName: !isAuthenticated
              ? `${parsed.data.firstName} ${parsed.data.lastName}`
              : undefined,
            guestEmail: !isAuthenticated ? parsed.data.email : undefined,
            guestPhone: parsed.data.phone || undefined,
            notes: parsed.data.notes || undefined,
            resourceRecordId: selectedResourceId,
            addonIds: selectedAddonIds,
          intakeAnswers,
          promotionCode: promotionCode.trim() || undefined,
          vehiclePlate: parsed.data.vehiclePlate,
          vehicleName: parsed.data.vehicleName,
          })

          if (fallback.success && fallback.appointmentId) {
            // A/B: konverzija tudi za "brez plačila" pot (fallback).
            if (organizationId) {
              void trackBookingConversion({
                organizationId,
                variant: abVariant,
                appointmentId: fallback.appointmentId,
              }).catch(() => {})
            }
            toast.info(t.booking.noPaymentToast)
            if (isAuthenticated) {
              router.push(`/my-appointments?new=${fallback.appointmentId}`)
            } else {
              // F2.2.2 P0-2: ohrani najemniški kontekst (custom domena =
              // "" — gola pot; /s/<slug> pod platformo).
              router.push(
                `${tenantPrefix}/booking/success?appointment=${fallback.appointmentId}`
              )
            }
            return { ok: true }
          }

          const fallbackError =
            fallback.error || withBusiness(t.booking.noPaymentFailed)
          setFlowError(fallbackError)
          toast.error(fallbackError)
          return { ok: false }
        }

        // Failure must be visible NEXT TO the button AND as a toast —
        // the summary card sits below the fold on mobile, so an inline
        // box alone reads as "nothing happened" (real-world finding).
        const message =
          result.error || t.booking.checkoutFailed
        setFlowError(message)
        toast.error(message)
        return { ok: false }
      } catch (err) {
        console.error("Error creating booking:", err)
        setFlowError(t.booking.unexpectedError)
        toast.error(t.booking.unexpectedError)
        return { ok: false }
      }
    },
    null
  )

  return (
    <form action={formAction} className="pb-20 lg:pb-0">
      {/* Employee Banner */}
      {isEmployee && (
        <Alert className="mb-6 border-primary/30 bg-linear-to-r from-primary/5 via-primary/10 to-accent/5 dark:border-primary/40 dark:from-primary/10 dark:via-primary/15 dark:to-accent/10">
          <SparkleIcon size={18} className="text-primary-text dark:text-primary-text" />
          <AlertDescription className="text-foreground/80 dark:text-foreground/90">
            {t.booking.employeeBanner}{" "}
            <strong className="text-primary-text">{t.booking.employeeBannerDiscount}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Form Steps */}
        <div className="space-y-6 lg:col-span-2">
          <BookingStepper
            label={t.booking.bookTitle}
            labels={{
              selection: t.booking.service,
              dateTime: t.booking.dateTime,
              details: t.booking.yourDetails,
            }}
            selectionDone={isStaffFirst ? !!selectedServiceId : true}
            dateTimeDone={!!selectedDate && !!selectedTime}
            detailsDone={!!(customerValues.firstName && customerValues.email && customerValues.phone)}
          />
          {/* Staff-first mode: Show preselected staff, then service selection */}
          {isStaffFirst ? (
            <>
              {/* Step 0: Staff Display (Read-only) */}
              <StaffDisplayStep staff={props.preselectedStaff} />

              {/* Step 1: Service Selection */}
              <ServiceSelectionStep
                services={props.staffServices}
                selectedServiceId={selectedServiceId}
                onSelectService={handleServiceSelect}
                error={!selectedServiceId && flowError ? t.booking.chooseServiceError : undefined}
              />
            </>
          ) : (
            <>
              {/* Service-first mode: Show service, then staff selection */}
              {/* Step 1: Service Display (Read-only) */}
              <ServiceStep service={props.service} />

              {/* Step 2: Staff Selection */}
              <StaffStep
                availableStaff={props.availableStaff}
                selectedStaffId={staffId}
                onSelectStaff={(id) => {
                  setValue("staffId", id, { shouldValidate: true })
                  clearErrors("staffId")
                }}
                error={errors.staffId?.message}
              />
            </>
          )}

          {/* Step 3: Date & Time Selection */}
          <DateTimeStep
            selectedStaffId={staffId}
            serviceDuration={(selectedService?.duration || 60) + addonDurationMin}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={(date) => {
              // Clicking the selected day again toggles it off in
              // react-day-picker (date === undefined) — keep the last valid
              // selection instead of losing it.
              const nextDate = date ?? selectedDate
              setValue("date", nextDate, { shouldValidate: true })
              clearErrors("date")
              // BUGFIX: clear a stale time when the day changes — otherwise
              // the summary shows an old time and submit would send a slot
              // that does not exist on the newly picked day.
              if (selectedTime && nextDate && selectedDate && !isSameDay(nextDate, selectedDate)) {
                setValue("time", "")
              }
            }}
            onSelectTime={(time) => {
              setValue("time", time, { shouldValidate: true })
              clearErrors("time")
            }}
            resources={resources}
            selectedResourceId={selectedResourceId}
            onSelectResource={(id) => {
              // The slot set depends on the resource — clear a stale time
              // (same reason as the day-change fix above).
              setSelectedResourceId(id)
              if (selectedTime) setValue("time", "")
            }}
            // #92: dodatki podaljšajo trajanje → sloti se spremenijo,
            // zastarel čas se počisti (isti razlog kot pri viru).
            addons={availableAddons}
            selectedAddonIds={selectedAddonIds}
            onToggleAddon={(id) => {
              setSelectedAddonIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
              if (selectedTime) setValue("time", "")
            }}
            maxBookingAdvance={salonConfig.maxBookingAdvance}
            dateError={errors.date?.message}
            timeError={errors.time?.message}
          />

          {/* Step 4: Customer Information */}
          <CustomerInfoStep
            values={customerValues}
            onChange={setCustomerField}
            errors={errors}
            isAuthenticated={isAuthenticated}
            // P1 #9 (audit-2026-11): inline validation on blur, same zod
            // schema as the server action (explicit single-field check —
            // RHF trigger() skips unregistered fields).
            onBlurField={validateCustomerField}
            // #96: sprejemni obrazec storitve (samo service-first; staff-first
            // ga v1 ne ponuja, ker se storitev šele izbira)
            intakeForm={intakeForm}
            intakeAnswers={intakeAnswers}
            onIntakeChange={(key, value) =>
              setIntakeAnswers((prev) => ({ ...prev, [key]: value }))
            }
            variant={abVariant}
          />

          {/* 2D-1W — neobavezni podatki o vozilu (delavnica vozil / tire-service).
              Preko skritih inputov gredo v FormData → createAppointment →
              poveže vozilo s stranko + rezervacijo (vozilo ostane vozilo). */}
          {props.showVehicle && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Podatki o vozilu (neobvezno)
                </CardTitle>
                <CardDescription className="text-sm">
                  Za vulkanizersko storitev lahko vnesete vozilo — povežemo ga s
                  stranko in rezervacijo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="vehiclePlate">Registrska oznaka</Label>
                  <Input
                    id="vehiclePlate"
                    value={customerValues.vehiclePlate}
                    onChange={(e) => setValue("vehiclePlate", e.target.value)}
                    placeholder="npr. LJ-123-AB"
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleName">Vozilo (ime/model)</Label>
                  <Input
                    id="vehicleName"
                    value={customerValues.vehicleName}
                    onChange={(e) => setValue("vehicleName", e.target.value)}
                    placeholder="npr. Škoda Octavia"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skriti inputi: controlled vrednosti morajo priti v FormData za
              React 19 action-submit obnovo po izpolnjevanju. */}
          <input type="hidden" name="vehiclePlate" value={customerValues.vehiclePlate} />
          <input type="hidden" name="vehicleName" value={customerValues.vehicleName} />

          {/* #97 (AD-07): no-show zaščita — izbira načina pologa. Privolitev
              je EKSPPLICITNA (checkbox z pravno formulacijo); brez nje se
              garancija ne aktivira. */}
          {guarantee.available && (
            <fieldset className="rounded-xl border bg-muted/30 p-4">
              {/* WCAG 1.3.1/4.1.2: radio grupa mora biti programatično
                  določljiva kot ena skupina — legend je obvezen za brajalnik
                  zaslona, da se načina pologa razbereta kot skupaj. */}
              <legend className="text-sm font-semibold">
                Polog — {guarantee.depositAmount.toFixed(2)}{" "}
                {guarantee.currency}
              </legend>
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === "deposit"}
                    onChange={() => setPaymentMode("deposit")}
                    className="mt-1 h-4 w-4"
                  />
                  <span>Plačaj polog zdaj (varno prek Stripe-a).</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === "guarantee"}
                    onChange={() => setPaymentMode("guarantee")}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <strong>Garancija s kartico</strong> — ničesar ne zaračunamo
                    zdaj; polog poravnate ob obisku. Ob ne-prihodu brez odjave
                    zaračunamo polog.
                  </span>
                </label>
              </div>

              {paymentMode === "guarantee" && (
                <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={noShowConsent}
                      onChange={(e) => setNoShowConsent(e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>{NO_SHOW_CONSENT_LABEL}</span>
                  </label>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">
                      Pravilnik no-show zaščite
                    </summary>
                    <p className="mt-2 whitespace-pre-line">{NO_SHOW_POLICY_TEXT}</p>
                  </details>
                </div>
              )}
            </fieldset>
          )}

          {/* F5.1: promocijska koda */}
          <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
            <label htmlFor="booking-promo-code" className="text-sm font-semibold">
              🏷️ Promocijska koda
            </label>
            <div className="flex gap-2">
              <input
                id="booking-promo-code"
                type="text"
                value={promotionCode}
                onChange={(e) => {
                  setPromotionCode(e.target.value)
                  setPromotionState(null)
                }}
                placeholder="npr. POLETJE20"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm uppercase"
              />
              <button
                type="button"
                onClick={handleCheckPromotionCode}
                disabled={isCheckingPromo || !promotionCode.trim()}
                className="shrink-0 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {isCheckingPromo ? "…" : "Preveri"}
              </button>
            </div>
            {promotionState && (
              <p
                role={promotionState.ok ? "status" : "alert"}
                aria-live={promotionState.ok ? "polite" : "assertive"}
                className={`text-xs ${
                  promotionState.ok
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}
              >
                {promotionState.ok ? `✓ ${promotionState.message}` : promotionState.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Če imate kodo za popust na storitve, jo vnesite tukaj. Uporabi se
              ob potrditvi rezervacije, če je veljavna.
            </p>
          </div>
        </div>

        {/* Right Column - Summary & Submit */}
        <div id="booking-summary" className="scroll-mt-24 lg:col-span-1">
          <BookingSummaryCard
            service={selectedService || null}
            selectedStaff={
              isStaffFirst
                ? props.preselectedStaff
                : props.availableStaff.find((s) => s.id === staffId)
            }
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedAddons={selectedAddons}
            salonConfig={salonConfig}
            submitting={isPending}
            error={flowError}
            isEmployee={isEmployee}
            paymentsEnabled={paymentsEnabled}
            availableSlots={[]}
          />
        </div>
      </div>

      {/* Hidden carriers for the React 19 action — selection state lives in
          React/RHF state, not in DOM inputs, so FormData needs explicit
          mirrors of exactly what the server action expects. */}
      {/* Mobile: the summary card sits BELOW the wizard, so keep the running
          selection (what + when) visible at the bottom of the screen. It is a
          jump link to the real summary — no duplicate submit path. */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 backdrop-blur-md lg:hidden">
        <a
          href="#booking-summary"
          className="mx-auto flex max-w-3xl items-center justify-between gap-3"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {selectedService?.name ?? t.booking.service}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {selectedDate && selectedTime
                ? `${format(selectedDate, "d. M.")} ${t.booking.atSeparator} ${selectedTime}`
                : t.booking.notSelected}
            </span>
          </span>
          <span className="text-primary-text shrink-0 text-sm font-semibold">
            {t.booking.summaryTitle}
          </span>
        </a>
      </div>

      <input type="hidden" name="staffId" value={staffId ?? ""} />
      <input
        type="hidden"
        name="date"
        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
      />
      <input type="hidden" name="time" value={selectedTime ?? ""} />
      <input
        type="hidden"
        name="resourceRecordId"
        value={selectedResourceId ?? ""}
      />
    </form>
  )
}
