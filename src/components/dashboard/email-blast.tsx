"use client"

// ============================================================
// EMAIL BLAST (Fresha-inspired 2026-11-15)
// Mass email to customer segments (tags).
// Like Fresha's "Send a Blast" feature.
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Megaphone,
  UsersIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"

interface EmailBlastProps {
  availableTags: string[]
  customerCounts: Record<string, number> // tag -> count
  totalCustomers: number
  marketingConsentCount: number
}

export function EmailBlast({
  availableTags,
  customerCounts,
  marketingConsentCount,
}: EmailBlastProps) {
  const [open, setOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState<"compose" | "preview" | "sent">("compose")

  // Calculate recipients
  const recipientCount =
    selectedTag === "all"
      ? marketingConsentCount
      : customerCounts[selectedTag] || 0

  const handlePreview = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Izpolnite zadevo in vsebino")
      return
    }
    setStep("preview")
  }

  const handleSend = async () => {
    setSending(true)
    // Simulate sending (in real app, this would call a server action)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setSending(false)
    setStep("sent")
    toast.success(`E-pošta poslana ${recipientCount} strankam!`)
  }

  const reset = () => {
    setStep("compose")
    setSubject("")
    setBody("")
    setSelectedTag("all")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone size={16} className="mr-2" />
          Nova kampanja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={20} />
            Email Blast — Množična pošta
          </DialogTitle>
          <DialogDescription>
            Pošljite promocijsko e-pošto izbranemu segmentu strank.
          </DialogDescription>
        </DialogHeader>

        {step === "compose" && (
          <div className="space-y-4">
            {/* Segment selector */}
            <div>
              <Label>Ciljna skupina</Label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <UsersIcon size={16} />
                      Vse stranke s privolitvijo ({marketingConsentCount})
                    </div>
                  </SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tag}</Badge>
                        ({customerCounts[tag] || 0} strank)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipient count */}
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
              <EnvelopeIcon size={18} className="text-blue-500" />
              <p className="text-sm text-blue-700">
                Prejemnikov: <strong>{recipientCount}</strong> strank
                {selectedTag !== "all" && (
                  <Badge variant="outline" className="ml-2">
                    {selectedTag}
                  </Badge>
                )}
              </p>
            </div>

            {/* Subject */}
            <div>
              <Label>Zadeva</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="npr. 🔥 Posebna ponudba — 20% popust!"
              />
            </div>

            {/* Body */}
            <div>
              <Label>Vsebina</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Pozdravljeni! Imamo posebno ponudbo za vas..."
                rows={8}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Nasvet: Uporabite vstavke {`{ime}`} za personalizacijo.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <Button onClick={handlePreview}>Predogled →</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <EnvelopeIcon size={18} />
                <span className="font-medium">Predogled e-pošte</span>
              </div>
              <Separator className="my-3" />
              <div className="space-y-2">
                <p>
                  <strong>Zadeva:</strong> {subject}
                </p>
                <Separator />
                <div className="whitespace-pre-wrap">{body}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3">
              <WarningCircleIcon size={18} className="text-amber-500" />
              <p className="text-sm text-amber-700">
                E-pošta bo poslana <strong>{recipientCount}</strong> strankam.
                Tega ni mogoče razveljaviti.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("compose")}>
                ← Nazaj
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? "Pošiljam..." : `Pošlji ${recipientCount} strankam`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "sent" && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircleIcon size={64} className="text-green-500" />
            </div>
            <h3 className="text-xl font-semibold">E-pošta poslana!</h3>
            <p className="text-muted-foreground">
              Uspešno poslano {recipientCount} strankam.
            </p>
            <Button onClick={reset}>Zapri</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
