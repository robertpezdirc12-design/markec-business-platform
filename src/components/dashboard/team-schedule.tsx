"use client"

// ============================================================
// TEAM SCHEDULE (Fresha-inspired 2026-11-15)
// Weekly team schedule with shifts and breaks.
// Like Fresha's "Team Schedule" — drag-and-drop planning.
// ============================================================

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  UsersIcon,
  ClockIcon,
  CalendarIcon,
  SunIcon,
  MoonIcon,
} from "@/components/icons"
import { Coffee as CoffeeIcon } from "@phosphor-icons/react/dist/ssr"

interface StaffSchedule {
  id: string
  name: string
  role: string
  shifts: {
    [day: string]: {
      isWorking: boolean
      start?: string
      end?: string
      breakStart?: string
      breakEnd?: string
    }
  }
}

interface TeamScheduleProps {
  schedule: StaffSchedule[]
}

const daysOfWeek = [
  { key: "monday", label: "Ponedeljek", short: "Pon" },
  { key: "tuesday", label: "Torek", short: "Tor" },
  { key: "wednesday", label: "Sreda", short: "Sre" },
  { key: "thursday", label: "Četrtek", short: "Čet" },
  { key: "friday", label: "Petek", short: "Pet" },
  { key: "saturday", label: "Sobota", short: "Sob" },
  { key: "sunday", label: "Nedelja", short: "Ned" },
]

function ShiftBadge({ start, end }: { start?: string; end?: string }) {
  if (!start || !end) return null
  
  const startHour = parseInt(start.split(":")[0])
  let icon = <SunIcon size={12} />
  let color = "bg-blue-100 text-blue-800"
  
  if (startHour >= 17) {
    icon = <MoonIcon size={12} />
    color = "bg-purple-100 text-purple-800"
  } else if (startHour >= 12) {
    icon = <SunIcon size={12} />
    color = "bg-amber-100 text-amber-800"
  }

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      {icon}
      {start}–{end}
    </Badge>
  )
}

export function TeamSchedule({ schedule }: TeamScheduleProps) {
  const [staff, setStaff] = useState<StaffSchedule[]>(schedule)

  const toggleWorking = (staffId: string, day: string) => {
    setStaff((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              shifts: {
                ...s.shifts,
                [day]: {
                  ...s.shifts[day],
                  isWorking: !s.shifts[day]?.isWorking,
                },
              },
            }
          : s
      )
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Urnik ekipe</h2>
          <p className="text-muted-foreground">
            Tedenski delovni čas in premori zaposlenih.
          </p>
        </div>
        <Button>
          <CalendarIcon size={16} className="mr-2" />
          Uredi urnik
        </Button>
      </div>

      {/* Schedule Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">Zaposleni</th>
                  {daysOfWeek.map((day) => (
                    <th key={day.key} className="p-4 text-center font-medium">
                      <div className="text-sm">{day.short}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b">
                    {/* Staff name */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold">
                          {member.name[0]}
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Days */}
                    {daysOfWeek.map((day) => {
                      const shift = member.shifts[day.key]
                      return (
                        <td key={day.key} className="p-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Switch
                              checked={shift?.isWorking || false}
                              onCheckedChange={() => toggleWorking(member.id, day.key)}
                            />
                            {shift?.isWorking && (
                              <>
                                <ShiftBadge start={shift.start} end={shift.end} />
                                {shift.breakStart && shift.breakEnd && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    <CoffeeIcon size={10} className="mr-1" />
                                    {shift.breakStart}–{shift.breakEnd}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zaposleni</p>
                <p className="text-2xl font-bold">{staff.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500 p-3 text-white">
                <ClockIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delovnih ur/teden</p>
                <p className="text-2xl font-bold">
                  {staff.reduce((total, member) => {
                    return total + daysOfWeek.filter((day) => member.shifts[day.key]?.isWorking).length * 8
                  }, 0)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <CalendarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pokritost</p>
                <p className="text-2xl font-bold">
                  {daysOfWeek.filter((day) =>
                    staff.some((member) => member.shifts[day.key]?.isWorking)
                  ).length}/7 dni
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
