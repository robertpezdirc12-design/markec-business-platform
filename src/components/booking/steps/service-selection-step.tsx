import { useFormatPrice } from "@/lib/currency"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClockIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { ServiceListItem } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/context"

interface ServiceSelectionStepProps {
  services: ServiceListItem[]
  selectedServiceId: string
  onSelectService: (serviceId: string) => void
  error?: string
}

export function ServiceSelectionStep({
  services,
  selectedServiceId,
  onSelectService,
  error,
}: ServiceSelectionStepProps) {
  const fmt = useFormatPrice()
  const { t } = useI18n()
  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            1
          </div>
          <CardTitle>{t.booking.chooseService}</CardTitle>
        </div>
        <CardDescription>{t.booking.chooseServiceDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border/60 divide-y overflow-hidden rounded-xl border">
          {services.map((service) => {
            const isSelected = selectedServiceId === service.id
            return (
              <li key={service.id}>
                <button
                  type="button"
                  onClick={() => onSelectService(service.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-3 p-3 text-left transition-colors sm:gap-4 sm:p-4",
                    isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] leading-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={cn(
                          "truncate font-semibold",
                          isSelected && "text-primary-text"
                        )}
                      >
                        {service.name}
                      </span>
                      {service.category && (
                        <span className="text-muted-foreground text-xs">
                          {service.category.name}
                        </span>
                      )}
                    </span>
                    {service.description && (
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 block text-sm">
                        {service.description}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {fmt(service.price)}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <ClockIcon size={12} />
                      {t.booking.minutesShort(service.duration)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Error message */}
        {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      </CardContent>
    </Card>
  )
}
