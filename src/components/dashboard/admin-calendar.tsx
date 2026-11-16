"use client"

// ============================================================
// ADMIN CALENDAR (Fresha-inspired 2026-11-15)
// Multi-view calendar: Day, Week, Month.
// Shows appointments in time slots with status colors.
// ============================================================

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CaretLeftIcon,
  CaretRightIcon,
  CalendarIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
} from "@/components/icons"
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  getHours,
  getMinutes,
  startOfDay,
  endOfDay,
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

type CalendarView = "day" | "week" | "month"

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
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>("week")
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Convert appointments to have Date objects
  const appointmentsWithDates = useMemo(() => {
    return appointments.map((apt) => ({
      ...apt,
      startTimeDate: new Date(apt.startTime),
      endTimeDate: new Date(apt.endTime),
    }))
  }, [appointments])

  // Navigation
  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date())
      return
    }
    
    const modifier = direction === "prev" ? -1 : 1
    
    switch (view) {
      case "day":
        setCurrentDate(addDays(currentDate, modifier))
        break
      case "week":
        setCurrentDate(addWeeks(currentDate, modifier))
        break
      case "month":
        setCurrentDate(addMonths(currentDate, modifier))
        break
    }
  }

  // Get appointments for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return appointmentsWithDates.filter((apt) => isSameDay(apt.startTimeDate, day))
  }

  // Week data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Month data
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const monthPaddingStart = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1

  // Time slots
  const timeSlots = useMemo(() => {
    const slots: number[] = []
    for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
      slots.push(h)
    }
    return slots
  }, [])

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
            <CaretLeftIcon size={16} />
          </Button>
          <Button variant="outline" onClick={() => navigate("today")}>
            Danes
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("next")}>
            <CaretRightIcon size={16} />
          </Button>
          
          {/* Date range display */}
          <h2 className="ml-2 text-lg font-semibold">
            {view === "day" && format(currentDate, "EEEE, d. MMMM yyyy", { locale: sl })}
            {view === "week" && (
              <>
                {format(weekStart, "d. MMM", { locale: sl })} — {format(weekEnd, "d. MMM yyyy", { locale: sl })}
              </>
            )}
            {view === "month" && format(currentDate, "MMMM yyyy", { locale: sl })}
          </h2>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={view === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
            >
              Dan
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
            >
              Teden
            </Button>
            <Button
              variant={view === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
            >
              Mesec
            </Button>
          </div>
          
          <Badge variant="outline">
            {view === "day" && getAppointmentsForDay(currentDate).length}
            {view === "week" && weekDays.reduce((sum, day) => sum + getAppointmentsForDay(day).length, 0)}
            {view === "month" && monthDays.reduce((sum, day) => sum + getAppointmentsForDay(day).length, 0)}
            {" "}terminov
          </Badge>
        </div>
      </div>

      {/* DAY VIEW */}
      {view === "day" && (
        <Card>
          <CardContent className="p-0">
            <div className="flex">
              {/* Time labels */}
              <div className="w-[80px] border-r">
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="border-b text-sm text-muted-foreground"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    <div className="pl-3 pt-2">{hour}:00</div>
                  </div>
                ))}
              </div>

              {/* Day column */}
              <div className="relative flex-1">
                {/* Hour lines */}
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-dashed"
                    style={{ height: SLOT_HEIGHT }}
                  />
                ))}

                {/* Appointments */}
                {getAppointmentsForDay(currentDate).map((apt) => {
                  const startHour = getHours(apt.startTimeDate) + getMinutes(apt.startTimeDate) / 60
                  const duration = (apt.endTimeDate.getTime() - apt.startTimeDate.getTime()) / (1000 * 60 * 60)
                  const top = (startHour - WORK_START_HOUR) * SLOT_HEIGHT
                  const height = Math.max(duration * SLOT_HEIGHT, 40)

                  return (
                    <div
                      key={apt.id}
                      className={`absolute left-2 right-2 rounded-lg border-l-4 px-3 py-2 ${statusColors[apt.status] || "bg-gray-100"}`}
                      style={{ top, height }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {format(apt.startTimeDate, "HH:mm")} — {format(apt.endTimeDate, "HH:mm")}
                          </p>
                          <p className="font-medium">
                            {apt.customer?.name || apt.guestName || "Gost"}
                          </p>
                          <p className="text-sm opacity-75">
                            {apt.services.map((s) => s.service.name).join(", ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[apt.status]}
                          </Badge>
                          <p className="mt-1 font-semibold">{apt.totalPrice} €</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WEEK VIEW */}
      {view === "week" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Day headers */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b">
                  <div className="p-2" />
                  {weekDays.map((day) => (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDay(day)
                        setView("day")
                      }}
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
                      {/* Appointment count */}
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getAppointmentsForDay(day).length}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Time grid */}
                <div className="relative">
                  {/* Time labels */}
                  <div className="absolute left-0 top-0 w-[80px]">
                    {timeSlots.map((hour) => (
                      <div
                        key={hour}
                        className="border-b text-xs text-muted-foreground"
                        style={{ height: SLOT_HEIGHT }}
                      >
                        <div className="pl-2 pt-1">{hour}:00</div>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  <div className="ml-[80px] grid grid-cols-7">
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
                            const startHour = getHours(apt.startTimeDate) + getMinutes(apt.startTimeDate) / 60
                            const duration = (apt.endTimeDate.getTime() - apt.startTimeDate.getTime()) / (1000 * 60 * 60)
                            const top = (startHour - WORK_START_HOUR) * SLOT_HEIGHT
                            const height = Math.max(duration * SLOT_HEIGHT, 30)

                            return (
                              <div
                                key={apt.id}
                                className={`absolute left-1 right-1 rounded border-l-2 px-1 py-0.5 text-xs ${statusColors[apt.status] || "bg-gray-100"}`}
                                style={{ top, height, overflow: "hidden" }}
                                title={`${format(apt.startTimeDate, "HH:mm")} — ${apt.customer?.name || apt.guestName || "Gost"} | ${apt.services.map((s) => s.service.name).join(", ")}`}
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
      )}

      {/* MONTH VIEW */}
      {view === "month" && (
        <Card>
          <CardContent className="p-0">
            {/* Day names */}
            <div className="grid grid-cols-7 border-b">
              {["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {/* Padding for first day */}
              {Array.from({ length: monthPaddingStart }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[120px] border-b border-l bg-muted/20" />
              ))}

              {/* Days */}
              {monthDays.map((day) => {
                const dayAppts = getAppointmentsForDay(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isTodayDate = isToday(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[120px] border-b border-l p-2 transition-colors ${
                      !isCurrentMonth
                        ? "bg-muted/20"
                        : isTodayDate
                          ? "bg-primary/5"
                          : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isTodayDate
                            ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            : !isCurrentMonth
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {dayAppts.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {dayAppts.length}
                        </Badge>
                      )}
                    </div>

                    {/* Appointments preview */}
                    <div className="mt-1 space-y-1">
                      {dayAppts.slice(0, 3).map((apt) => (
                        <div
                          key={apt.id}
                          className={`truncate rounded px-1 py-0.5 text-xs ${statusColors[apt.status] || "bg-gray-100"}`}
                          title={`${format(apt.startTimeDate, "HH:mm")} — ${apt.customer?.name || apt.guestName}`}
                        >
                          {format(apt.startTimeDate, "HH:mm")} {apt.customer?.name || apt.guestName || "Gost"}
                        </div>
                      ))}
                      {dayAppts.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayAppts.length - 3} več
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Day Detail (only in month view) */}
      {view === "month" && selectedDay && (
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
                  .sort((a, b) => a.startTimeDate.getTime() - b.startTimeDate.getTime())
                  .map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-semibold">
                          {format(apt.startTimeDate, "HH:mm")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(apt.endTimeDate, "HH:mm")}
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