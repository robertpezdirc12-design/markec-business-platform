"use client"

// ============================================================
// ONLINE BOOKING PAGE (Fresha-inspired 2026-11-15)
// Modern, step-by-step booking experience.
// Service → Staff → Date/Time → Details → Confirm
// ============================================================

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  StarIcon,
} from "@/components/icons"
import { format, addDays, isSameDay } from "date-fns"
import { sl } from "date-fns/locale"

interface Service {
  id: string
  name: string
  description: string | null
  duration: number
  price: number
  imageUrl: string | null
  category: string | null
  isFeatured: boolean
}

interface StaffMember {
  id: string
  name: string
  role: string
  imageUrl: string | null
  rating: number
}

interface TimeSlot {
  time: string
  available: boolean
}

// Static time slots (9:00–17:30). Deterministic availability — hoisted to
// module scope so it is not recomputed on every render (no runtime deps).
const TIME_SLOTS: TimeSlot[] = (() => {
  const slots: TimeSlot[] = []
  for (let h = 9; h < 18; h++) {
    slots.push({ time: `${h.toString().padStart(2, "0")}:00`, available: true })
    // Deterministic availability based on time (no Math.random)
    const isAvailable = h % 3 !== 0 && h % 5 !== 0
    slots.push({ time: `${h.toString().padStart(2, "0")}:30`, available: isAvailable })
  }
  return slots
})()

interface OnlineBookingPageProps {
  services: Service[]
  staff: StaffMember[]
  businessName: string
  businessImage?: string | null
}

type BookingStep = "service" | "staff" | "datetime" | "details" | "confirm"

export function OnlineBookingPage({
  services,
  staff,
  businessName,
  businessImage,
}: OnlineBookingPageProps) {
  const [step, setStep] = useState<BookingStep>("service")
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [notes, setNotes] = useState("")

  const timeSlots = TIME_SLOTS

  // Generate next 14 days
  const availableDates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))
  }, [])

  const steps: { key: BookingStep; label: string; icon: React.ReactNode }[] = [
    { key: "service", label: "Storitev", icon: <CheckCircleIcon size={16} /> },
    { key: "staff", label: "Strokovnjak", icon: <UserIcon size={16} /> },
    { key: "datetime", label: "Termin", icon: <CalendarIcon size={16} /> },
    { key: "details", label: "Podatki", icon: <CheckCircleIcon size={16} /> },
    { key: "confirm", label: "Potrditev", icon: <CheckCircleIcon size={16} /> },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  const canProceed = () => {
    switch (step) {
      case "service":
        return !!selectedService
      case "staff":
        return !!selectedStaff
      case "datetime":
        return !!selectedTime
      case "details":
        return customerName.trim() && customerEmail.trim()
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1].key)
    }
  }

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1].key)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{businessName}</h1>
        <p className="mt-2 text-muted-foreground">
          Rezervirajte svoj termin v nekaj korakih
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : i < currentStepIndex
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStepIndex ? (
                <CheckCircleIcon size={18} />
              ) : (
                s.icon
              )}
            </div>
            <div className="ml-2 hidden sm:block">
              <p className={`text-sm font-medium ${step === s.key ? "text-primary" : ""}`}>
                {s.label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-4 h-0.5 w-12 ${
                  i < currentStepIndex ? "bg-green-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Step Content */}
        <div className="lg:col-span-2">
          {/* SERVICE STEP */}
          {step === "service" && (
            <Card>
              <CardHeader>
                <CardTitle>Izberite storitev</CardTitle>
                <CardDescription>
                  Izberite storitev, ki jo želite rezervirati.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        selectedService?.id === service.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{service.name}</p>
                            {service.isFeatured && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                                <StarIcon size={10} className="mr-1" />
                                Priporočeno
                              </Badge>
                            )}
                          </div>
                          {service.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {service.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ClockIcon size={14} />
                              {service.duration} min
                            </span>
                            {service.category && (
                              <Badge variant="outline" className="text-xs">
                                {service.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{service.price} €</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* STAFF STEP */}
          {step === "staff" && (
            <Card>
              <CardHeader>
                <CardTitle>Izberite strokovnjaka</CardTitle>
                <CardDescription>
                  Izberite osebo, ki bo opravila storitev.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {staff.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedStaff(member)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selectedStaff?.id === member.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-semibold">
                          {member.name[0]}
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.role}</p>
                          <div className="mt-1 flex items-center gap-1">
                            <StarIcon size={12} className="text-amber-400" weight="fill" />
                            <span className="text-xs text-muted-foreground">
                              {member.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DATETIME STEP */}
          {step === "datetime" && (
            <Card>
              <CardHeader>
                <CardTitle>Izberite termin</CardTitle>
                <CardDescription>
                  Izberite datum in uro, ki vam najbolj ustreza.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Date picker */}
                  <div>
                    <Label className="mb-3 block">Datum</Label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {availableDates.map((date) => (
                        <button
                          key={date.toISOString()}
                          onClick={() => setSelectedDate(date)}
                          className={`flex-shrink-0 rounded-lg border p-3 text-center transition-colors ${
                            isSameDay(date, selectedDate)
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <p className="text-xs text-muted-foreground">
                            {format(date, "EEE", { locale: sl })}
                          </p>
                          <p className="text-lg font-semibold">
                            {format(date, "d")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(date, "MMM", { locale: sl })}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div>
                    <Label className="mb-3 block">Ura</Label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`rounded-lg border p-2 text-center text-sm transition-colors ${
                            selectedTime === slot.time
                              ? "border-primary bg-primary text-primary-foreground"
                              : slot.available
                                ? "hover:bg-muted/50"
                                : "cursor-not-allowed opacity-50"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DETAILS STEP */}
          {step === "details" && (
            <Card>
              <CardHeader>
                <CardTitle>Vaši podatki</CardTitle>
                <CardDescription>
                  Vnesite podatke za potrditev rezervacije.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Ime in priimek *</Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Janez Novak"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-pošta *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="janez@email.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="041 234 567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Opombe</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Posebne želje ali opombe..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CONFIRM STEP */}
          {step === "confirm" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircleIcon size={20} className="text-green-500" />
                  Rezervacija uspešna!
                </CardTitle>
                <CardDescription>
                  Vaša rezervacija je bila uspešno oddana.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 p-4">
                    <p className="text-green-800">
                      Potrditveno e-pošto smo poslali na <strong>{customerEmail}</strong>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Povzetek rezervacije:</h4>
                    <div className="rounded-lg border p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Storitev:</span>
                          <span className="font-medium">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Strokovnjak:</span>
                          <span className="font-medium">{selectedStaff?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Datum:</span>
                          <span className="font-medium">
                            {format(selectedDate, "EEEE, d. MMMM yyyy", { locale: sl })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ura:</span>
                          <span className="font-medium">{selectedTime}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cena:</span>
                          <span className="text-lg font-bold">{selectedService?.price} €</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          {step !== "confirm" && (
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeftIcon size={16} className="mr-2" />
                Nazaj
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                {step === "details" ? "Potrdi rezervacijo" : "Naprej"}
                <ArrowRightIcon size={16} className="ml-2" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Povzetek</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedService && (
                  <div>
                    <p className="text-sm text-muted-foreground">Storitev</p>
                    <p className="font-medium">{selectedService.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedService.duration} min
                    </p>
                  </div>
                )}

                {selectedStaff && (
                  <div>
                    <p className="text-sm text-muted-foreground">Strokovnjak</p>
                    <p className="font-medium">{selectedStaff.name}</p>
                  </div>
                )}

                {selectedTime && (
                  <div>
                    <p className="text-sm text-muted-foreground">Termin</p>
                    <p className="font-medium">
                      {format(selectedDate, "d. MMM yyyy", { locale: sl })}
                    </p>
                    <p className="font-medium">{selectedTime}</p>
                  </div>
                )}

                {selectedService && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Skupaj:</span>
                      <span className="text-xl font-bold">
                        {selectedService.price} €
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}