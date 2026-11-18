"use client"

import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AvailableStaffMember } from "@/lib/interfaces"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

interface StaffStepProps {
  availableStaff: AvailableStaffMember[]
  selectedStaffId: string
  onSelectStaff: (staffId: string) => void
  error?: string
}

export function StaffStep({
  availableStaff,
  selectedStaffId,
  onSelectStaff,
  error,
}: StaffStepProps) {
  const { t } = useI18n()
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            1
          </div>
          <CardTitle>{t.booking.chooseSpecialist}</CardTitle>
        </div>
        <CardDescription>{t.booking.chooseSpecialistDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableStaff.length === 0 ? (
          <p className="text-muted-foreground text-center">{t.booking.noStaffForService}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableStaff.map((staff) => {
              const isSelected = selectedStaffId === staff.id
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => onSelectStaff(staff.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  )}
                >
                  <span className="bg-muted relative block aspect-[4/3] w-full overflow-hidden">
                    {staff.image ? (
                      <Image
                        src={cloudinaryPresets.staffAvatar(staff.image)}
                        alt={staff.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 320px"
                      />
                    ) : (
                      <span className="bg-primary/10 text-primary-text flex h-full w-full items-center justify-center text-3xl font-semibold">
                        {staff.name.charAt(0)}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="bg-primary text-primary-foreground absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="block p-3 sm:p-4">
                    <span className="block font-semibold">{staff.name}</span>
                    {staff.bio && (
                      <span className="text-muted-foreground mt-1 line-clamp-2 block text-sm">
                        {staff.bio}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  )
}
