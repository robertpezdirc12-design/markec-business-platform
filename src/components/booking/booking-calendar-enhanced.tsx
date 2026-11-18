"use client"

// ============================================================
// ENHANCED BOOKING CALENDAR (Fresha-inspired 2026-11-15)
// Visual calendar with available time slots.
// Shows morning/afternoon/evening slots with availability.
// ============================================================

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CalendarIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@/components/icons"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from "date-fns"
import { sl } from "date-fns/locale"

interface TimeSlot {
  time: string
  available: boolean
  formattedTime: string
}

interface BookingCalendarProps {
  availableDates?: Date[]
  timeSlots?: TimeSlot[]
  selectedDate?: Date
  selectedTime?: string
  onDateSelect?: (date: Date) => void
  onTimeSelect?: (time: string) => void
}

// Group time slots by period
function groupSlotsByPeriod(slots: TimeSlot[]) {
  return {
    morning: slots.filter((s) => parseInt(s.time.split(":")[0]) < 12),
    afternoon: slots.filter((s) => {
      const hour = parseInt(s.time.split(":")[0])
      return hour >= 12 && hour < 17
    }),
    evening: slots.filter((s) => parseInt(s.time.split(":")[0]) >= 17),
  }
}

export function BookingCalendar({
  availableDates = [],
  timeSlots = [],
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get first day of week for padding
  const firstDayOfWeek = getDay(monthStart)
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Monday start

  const periods = useMemo(() => groupSlotsByPeriod(timeSlots), [timeSlots])

  const isDateAvailable = (date: Date) => {
    return availableDates.some((d) => isSameDay(d, date))
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon size={20} />
              Izberite datum
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <CaretLeftIcon size={16} />
              </Button>
              <span className="font-semibold">
                {format(currentMonth, "MMMM yyyy", { locale: sl })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <CaretRightIcon size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day names */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding for first day */}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {/* Days */}
            {monthDays.map((day) => {
              const available = isDateAvailable(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => available && onDateSelect?.(day)}
                  disabled={!available || isPast}
                  className={`
                    rounded-lg p-2 text-center transition-all
                    ${isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : available && !isPast
                        ? "bg-green-50 hover:bg-green-100 border border-green-200"
                        : "text-muted-foreground opacity-50"
                    }
                    ${isToday(day) && !isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                  `}
                >
                  <div className="text-sm">{format(day, "d")}</div>
                  {available && !isPast && (
                    <div className="mt-1 flex justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              Na voljo
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-300" />
              Zasedeno
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Slots */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon size={20} />
              Izberite uro — {format(selectedDate, "EEEE, d. MMMM", { locale: sl })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeSlots.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Na ta dan ni prostih terminov
              </p>
            ) : (
              <div className="space-y-6">
                {/* Morning */}
                {periods.morning.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <SunIcon size={16} className="text-amber-500" />
                      Dopoldne
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {periods.morning.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && onTimeSelect?.(slot.time)}
                          disabled={!slot.available}
                          className={`
                            rounded-lg border p-2 text-center text-sm transition-all
                            ${selectedTime === slot.time
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : slot.available
                                ? "border-green-200 bg-green-50 hover:bg-green-100"
                                : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                            }
                          `}
                        >
                          {slot.formattedTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon */}
                {periods.afternoon.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <SunIcon size={16} className="text-orange-500" />
                      Popoldne
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {periods.afternoon.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && onTimeSelect?.(slot.time)}
                          disabled={!slot.available}
                          className={`
                            rounded-lg border p-2 text-center text-sm transition-all
                            ${selectedTime === slot.time
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : slot.available
                                ? "border-green-200 bg-green-50 hover:bg-green-100"
                                : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                            }
                          `}
                        >
                          {slot.formattedTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening */}
                {periods.evening.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MoonIcon size={16} className="text-blue-500" />
                      Zvečer
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {periods.evening.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && onTimeSelect?.(slot.time)}
                          disabled={!slot.available}
                          className={`
                            rounded-lg border p-2 text-center text-sm transition-all
                            ${selectedTime === slot.time
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : slot.available
                                ? "border-green-200 bg-green-50 hover:bg-green-100"
                                : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                            }
                          `}
                        >
                          {slot.formattedTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
