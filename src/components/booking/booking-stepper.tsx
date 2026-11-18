"use client"

import { cn } from "@/lib/utils"

export interface BookingStepperLabels {
  selection: string
  dateTime: string
  details: string
}

interface BookingStepperProps {
  /** Step 1 is satisfied (service and staff chosen / resolved) */
  selectionDone: boolean
  /** Step 2 is satisfied (date and time chosen) */
  dateTimeDone: boolean
  /** Step 3 is satisfied (contact info filled and valid) */
  detailsDone: boolean
  /** Step labels from i18n — keep the same order as the steps above. */
  labels: BookingStepperLabels
  /** Accessible label for the stepper nav */
  label?: string
}

interface Step {
  id: number
  label: string
  icon: string
  completed: boolean
  current: boolean
}

export function BookingStepper({
  selectionDone,
  dateTimeDone,
  detailsDone,
  labels,
  label = "Booking progress",
}: BookingStepperProps) {
  const steps: Step[] = [
    {
      id: 1,
      label: labels.selection,
      icon: "scissors",
      completed: selectionDone,
      current: !selectionDone,
    },
    {
      id: 2,
      label: labels.dateTime,
      icon: "calendar",
      completed: dateTimeDone,
      current: selectionDone && !dateTimeDone,
    },
    {
      id: 3,
      label: labels.details,
      icon: "user-circle",
      completed: detailsDone,
      current: selectionDone && dateTimeDone && !detailsDone,
    },
  ]

  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-1 overflow-x-auto sm:gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 items-center gap-1 sm:gap-2">
            {/* Step circle */}
            <div
              aria-current={step.current ? "step" : undefined}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                step.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : step.current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {step.completed ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                step.id
              )}
            </div>
            {/* Step label */}
            <span
              className={cn(
                "truncate text-xs font-medium sm:text-sm",
                step.completed || step.current
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-1 hidden h-px flex-1 sm:block sm:min-w-4",
                  step.completed ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
