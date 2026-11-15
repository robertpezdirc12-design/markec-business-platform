"use client"

// ============================================================
// ADMIN CALENDAR (Fresha-inspired 2026-11-15)
// Weekly calendar view for appointments.
// Shows appointments in time slots with staff columns.
// ============================================================

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CaretLeftIcon,
  CaretRightIcon,
  CalendarIcon,
} from "@/components/icons"
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from "date-fns"
import { sl } from "date-fns/locale"

interface CalendarAppointment {
  id: string
  startTime: string | Date
  endTime: string | Date
  status: string
  customer?: { name: string | null } | null
  guestName?: string | null
  staff: { id: string; name: string }
  services: { service: { name: string } }[]
  totalPrice: number
}

interface AdminCalendarProps {
  appointments: CalendarAppointment[]
  salonTz?: string
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 border-amber-300 text-amber-800",
  CONFIRMED: "bg-blue-100 border-blue-300 text-blue-800",
  COMPLETED: "bg-green-100 border-green-300 text-green-800",
  CANCELLED: "bg-red-100 border-red-300 text-red-800",
  NO_SHOW: "bg-gray-100 border-gray-300 text-gray-800",
}

const statusLabels: Record<string, string> = {
  PENDING: "V čakanju",
  CONFIRMED: "Potrjeno",
  COMPLETED: "Zaključeno",
  CANCELLED: "Preklicano",
  NO_SHOW: "Ni se prikazal",
}

// Working hours: 8:00 - 20:00
const WORK_START_HOUR = 8
const WORK_END_HOUR = 20
const SLOT_HEIGHT = 60 // pixels per hour

export function AdminCalendar({ appointments, salonTz }: AdminCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Get unique staff from appointments
  const staffList = useMemo(() => {
    const staffMap = new Map<string, string>()
    appointments.forEach((apt) => {
      if (apt.staff?.id) {
        staffMap.set(apt.staff.id, apt.staff.name)
      }
    })
    return Array.from(staffMap.entries()).map(([id, name]) => ({ id, name }))
  }, [appointments])

  // Filter appointments for current week
  const weekAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startTime)
      return aptDate >= weekStart && aptDate <= weekEnd
    })
  }, [appointments, weekStart, weekEnd])

  // Get appointments for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return weekAppointments.filter((apt) => isSameDay(new Date(apt.startTime), day))
  }

  // Generate time slots (hours)
  const timeSlots = useMemo(() => {
    const slots: number[] = []
    for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
      slots.push(h)
    }
    return slots
  }, [])

  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const goToToday = () => setCurrentWeek(new Date())

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <CaretLeftIcon size={16} />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Danes
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <CaretRightIcon size={16} />
          </Button>
          <h2 className="ml-2 text-lg font-semibold">
            {format(weekStart, "d. MMM", { locale: sl })} — {format(weekEnd, "d. MMM yyyy", { locale: sl })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{weekAppointments.length} terminov</Badge>
        </div>
      </div>

      {/* Week View */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
                <div className="p-2" />
                {weekDays.map((day) => (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={`border-l p-2 text-center transition-colors ${
                      isToday(day)
                        ? "bg-primary/5"
                        : selectedDay && isSameDay(day, selectedDay)
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE", { locale: sl })}
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        isToday(day) ? "text-primary" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                  </button>
                ))}
              </div>

              {/* Time grid */}
              <div className="relative">
                {/* Time labels */}
                <div className="absolute left-0 top-0 w-[60px]">
                  {timeSlots.map((hour) => (
                    <div
                      key={hour}
                      className="border-b text-xs text-muted-foreground"
                      style={{ height: SLOT_HEIGHT }}
                    >
                      <div className="-mt-2 pl-2 pt-2">{hour}:00</div>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                <div className="ml-[60px] grid grid-cols-7">
                  {weekDays.map((day) => {
                    const dayAppts = getAppointmentsForDay(day)
                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative border-l ${
                          isToday(day) ? "bg-primary/5" : ""
                        }`}
                        style={{ height: (WORK_END_HOUR - WORK_START_HOUR) * SLOT_HEIGHT }}
                      >
                        {/* Hour lines */}
                        {timeSlots.map((hour) => (
                          <div
                            key={hour}
                            className="border-b border-dashed"
                            style={{ height: SLOT_HEIGHT }}
                          />
                        ))}

                        {/* Appointments */}
                        {dayAppts.map((apt) => {
                          const start = new Date(apt.startTime)
                          const end = new Date(apt.endTime)
                          const startHour = getHours(start) + getMinutes(start) / 60
                          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                          const top = (startHour - WORK_START_HOUR) * SLOT_HEIGHT
                          const height = Math.max(duration * SLOT_HEIGHT, 30)

                          return (
                            <div
                              key={apt.id}
                              className={`absolute left-1 right-1 rounded border-l-2 px-1 py-0.5 text-xs ${statusColors[apt.status] || "bg-gray-100"}`}
                              style={{ top, height, overflow: "hidden" }}
                              title={`${format(start, "HH:mm")} — ${apt.customer?.name || apt.guestName || "Gost"} | ${apt.services.map((s) => s.service.name).join(", ")}`}
                            >
                              <div className="font-medium truncate">
                                {apt.customer?.name || apt.guestName || "Gost"}
                              </div>
                              <div className="truncate opacity-75">
                                {apt.services.map((s) => s.service.name).join(", ")}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Detail */}
      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon size={20} />
              {format(selectedDay, "EEEE, d. MMMM yyyy", { locale: sl })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getAppointmentsForDay(selectedDay).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Na ta dan ni terminov
              </p>
            ) : (
              <div className="space-y-3">
                {getAppointmentsForDay(selectedDay)
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-semibold">
                          {format(new Date(apt.startTime), "HH:mm")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(apt.endTime), "HH:mm")}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {apt.customer?.name || apt.guestName || "Gost"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {apt.services.map((s) => s.service.name).join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {apt.staff?.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[apt.status]}>
                          {statusLabels[apt.status] || apt.status}
                        </Badge>
                        <span className="font-semibold">{apt.totalPrice} €</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
