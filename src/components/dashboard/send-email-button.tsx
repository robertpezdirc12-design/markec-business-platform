"use client"

// ============================================================
// SEND EMAIL TO CUSTOMER (Fresha-inspired 2026-11-15)
// Quick email composer with template-based content.
// Like Fresha's "Send email" feature — pre-built templates + custom.
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { EnvelopeIcon, ArrowRightIcon } from "@/components/icons"
import { generateEmailContent } from "@/lib/smart-content-generator"

interface SendEmailButtonProps {
  customerName: string
  customerEmail?: string | null
  serviceName?: string
  businessName?: string
}

const emailTypes = [
  { value: "confirmation", label: "✅ Potrditev rezervacije" },
  { value: "reminder", label: "⏰ Opomnik za termin" },
  { value: "followup", label: "💚 Zahvala po obisku" },
  { value: "birthday", label: "🎂 Rojstni dan" },
  { value: "promo", label: "✨ Promocijska ponudba" },
  { value: "custom", label: "✏️ Sporočilo po meri" },
] as const

export function SendEmailButton({
  customerName,
  customerEmail,
  serviceName,
  businessName,
}: SendEmailButtonProps) {
  const [open, setOpen] = useState(false)
  const [emailType, setEmailType] = useState<string>("confirmation")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  // Generate content when type changes
  const handleTypeChange = (type: string) => {
    setEmailType(type)
    if (type === "custom") {
      setSubject("")
      setBody("")
      return
    }

    const content = generateEmailContent({
      type: type as any,
      customerName,
      serviceName: serviceName || "storitev",
      date: "datum termina",
      time: "ura termina",
      staffName: "naš strokovnjak",
      businessName,
    })

    setSubject(content.subject)
    setBody(content.body)
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Izpolnite zadevo in vsebino")
      return
    }

    setLoading(true)
    // Simulate sending (in real app, this would call a server action)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLoading(false)
    setOpen(false)
    toast.success(`E-pošta poslana na ${customerEmail || "stranko"}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <EnvelopeIcon size={16} className="mr-2" />
          Pošlji e-pošto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pošlji e-pošto stranki</DialogTitle>
          <DialogDescription>
            Izberite predlogo ali napišite sporočilo po meri.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div>
            <Label>Vrsta sporočila</Label>
            <Select value={emailType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div>
            <Label>Za</Label>
            <Input value={customerEmail || customerName} disabled />
          </div>

          {/* Subject */}
          <div>
            <Label>Zadeva</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Vnesite zadevo..."
            />
          </div>

          {/* Body */}
          <div>
            <Label>Vsebina</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Vnesite vsebino sporočila..."
              rows={10}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <span className="mr-2">Pošiljam...</span>
                </>
              ) : (
                <>
                  <ArrowRightIcon size={16} className="mr-2" />
                  Pošlji
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Prekliči
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
