"use client"

import { cn } from "@/lib/utils"

export interface BookingStepperLabels {
  service: string
  staff: string
  dateTime: string
  details: string
}

interface BookingStepperProps {
  /** Step 1 is satisfied (service chosen / preselected). */
  serviceDone: boolean
  /** Step 2 is satisfied (specialist chosen / preselected). */
  staffDone: boolean
  /** Step 3 is satisfied (date AND time chosen). */
  slotDone: boolean
  /** Step 4 is satisfied (contact details filled). */
  detailsDone: boolean
  labels: BookingStepperLabels
  /** Accessible name of the progress list. */
  label: string
}

/**
 * Wizard progress for the public booking flow — the pattern every modern
 * booking reference uses: numbered steps, completed steps become a check,
 * the current step is highlighted. Purely presentational: all steps live on
 * the same page, so this is a position indicator, never navigation.
 */
export function BookingStepper({
  serviceDone,
  staffDone,
  slotDone,
  detailsDone,
  labels,
  label,
}: BookingStepperProps) {
  const steps = [
    { id: 1, label: labels.service, done: serviceDone },
    { id: 2, label: labels.staff, done: staffDone },
    { id: 3, label: labels.dateTime, done: slotDone },
    { id: 4, label: labels.details, done: detailsDone },
  ]
  const current = steps.find((step) => !step.done)?.id ?? steps.length

  return (
    <ol
      aria-label={label}
      className="border-border/60 bg-card shadow-xs flex items-center gap-1 rounded-2xl border p-2 sm:gap-2 sm:p-3"
    >
      {steps.map((step, index) => {
        const isCurrent = step.id === current
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                    ? "bg-primary/10 text-primary-text ring-primary/40 ring-2"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <span aria-hidden="true">{step.done ? "✓" : step.id}</span>
              {/* Labels are hidden on narrow screens; the accessible name
                  travels with the node so the step is never a bare number. */}
              <span className="sr-only sm:hidden">{step.label}</span>
            </span>
            <span
              className={cn(
                "hidden truncate text-sm sm:block",
                isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="bg-border hidden h-px flex-1 sm:block" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
