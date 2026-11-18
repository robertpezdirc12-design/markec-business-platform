"use client"

// ============================================================
// EMAIL TEMPLATES EDITOR (Fresha-inspired 2026-11-15)
// Customize email templates for different occasions.
// Preview, variables, and branding.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  
  
  
  
  
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  EnvelopeIcon,
  PencilIcon,
  EyeIcon,
  CheckCircleIcon,
  SparkleIcon,
} from "@/components/icons"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: "booking" | "marketing" | "system"
  lastModified?: string
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: "confirmation",
    name: "Potrditev rezervacije",
    subject: "✅ Potrditev rezervacije — {{serviceName}}",
    body: `Pozdravljeni {{customerName}},

vaša rezervacija je bila uspešno potrjena!

📋 Podrobnosti:
• Storitev: {{serviceName}}
• Datum: {{date}}
• Ura: {{time}}
• Strokovnjak: {{staffName}}
• Cena: {{price}} €

Veselimo se vašega obiska!

Lep pozdrav,
{{businessName}}`,
    category: "booking",
    lastModified: "2026-11-15",
  },
  {
    id: "reminder",
    name: "Opomnik za termin",
    subject: "⏰ Opomnik — {{serviceName}} jutri",
    body: `Pozdravljeni {{customerName}},

spominjamo vas na vaš jutrišnji termin:

📋 Podrobnosti:
• Storitev: {{serviceName}}
• Datum: {{date}}
• Ura: {{time}}

Če ne morete priti, nas pravočasno obvestite.

Lep pozdrav,
{{businessName}}`,
    category: "booking",
    lastModified: "2026-11-14",
  },
  {
    id: "followup",
    name: "Zahvala po obisku",
    subject: "Hvala za obisk! 💚",
    body: `Pozdravljeni {{customerName}},

hvala za vaš obisk! Upamo, da ste bili zadovoljni s storitvijo {{serviceName}}.

Vaše mnenje nam veliko pomeni. Prosimo, delite vašo izkušnjo.

{{reviewLink}}

Lep pozdrav,
{{businessName}}`,
    category: "marketing",
    lastModified: "2026-11-13",
  },
  {
    id: "birthday",
    name: "Čestitka ob rojstnem dnevu",
    subject: "🎂 Vse najboljše, {{customerName}}!",
    body: `Pozdravljeni {{customerName}},

ob vašem rojstnem dnevu vam želimo vse najboljše! 🎉

V zahvalo vam podarjamo 10% popust na naslednjo storitev.

Koda: {{promoCode}}

Velja 30 dni.

Lep pozdrav,
{{businessName}}`,
    category: "marketing",
    lastModified: "2026-11-12",
  },
  {
    id: "welcome",
    name: "Dobrodošlica novi stranki",
    subject: "Dobrodošli v {{businessName}}! 👋",
    body: `Pozdravljeni {{customerName}},

veseli smo, da ste se pridružili {{businessName}}!

Tu je nekaj stvari, ki jih lahko storite:
• Rezervirajte termin online
• Prebrskajte naše storitve
• Sledite nam na socialnih omrežjih

{{bookingLink}}

Lep pozdrav,
{{businessName}}`,
    category: "marketing",
    lastModified: "2026-11-10",
  },
]

const availableVariables = [
  { key: "{{customerName}}", description: "Ime stranke" },
  { key: "{{serviceName}}", description: "Ime storitve" },
  { key: "{{date}}", description: "Datum termina" },
  { key: "{{time}}", description: "Ura termina" },
  { key: "{{staffName}}", description: "Ime strokovnjaka" },
  { key: "{{price}}", description: "Cena storitve" },
  { key: "{{businessName}}", description: "Ime podjetja" },
  { key: "{{bookingLink}}", description: "Povezava za rezervacijo" },
  { key: "{{reviewLink}}", description: "Povezava za mnenje" },
  { key: "{{promoCode}}", description: "Promocijska koda" },
]

export function EmailTemplatesEditor() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate({ ...template })
  }

  const handleSave = () => {
    if (!editingTemplate) return
    
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingTemplate.id
          ? { ...editingTemplate, lastModified: new Date().toISOString().split("T")[0] }
          : t
      )
    )
    setEditingTemplate(null)
    toast.success("Predloga shranjena")
  }

  const handleInsertVariable = (variable: string) => {
    if (!editingTemplate) return
    
    // Insert at cursor position (simplified)
    setEditingTemplate((prev) =>
      prev ? { ...prev, body: prev.body + " " + variable } : null
    )
  }

  const categoryLabels = {
    booking: "Rezervacije",
    marketing: "Marketing",
    system: "Sistem",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-poštne predloge</h2>
          <p className="text-muted-foreground">
            Prilagodite e-poštna sporočila za različne priložnosti.
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon size={18} className="text-primary" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    {template.subject}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {categoryLabels[template.category]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Preview */}
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {template.body.substring(0, 150)}...
                  </p>
                </div>

                {/* Variables */}
                <div className="flex flex-wrap gap-1">
                  {template.body.match(/\{\{(\w+)\}\}/g)?.slice(0, 3).map((variable) => (
                    <Badge key={variable} variant="secondary" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <PencilIcon size={14} className="mr-1" />
                    Uredi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template)
                      setShowPreview(true)
                    }}
                  >
                    <EyeIcon size={14} className="mr-1" />
                    Predogled
                  </Button>
                </div>

                {/* Last modified */}
                {template.lastModified && (
                  <p className="text-xs text-muted-foreground">
                    Spremenjeno: {template.lastModified}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Uredi predlogo</DialogTitle>
            <DialogDescription>
              Prilagodite vsebino e-poštne predloge.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <Label>Zadeva</Label>
                <Input
                  value={editingTemplate.subject}
                  onChange={(e) =>
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, subject: e.target.value } : null
                    )
                  }
                />
              </div>

              {/* Body */}
              <div>
                <Label>Vsebina</Label>
                <Textarea
                  value={editingTemplate.body}
                  onChange={(e) =>
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, body: e.target.value } : null
                    )
                  }
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {/* Variables */}
              <div>
                <Label>Spremenljivke</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableVariables.map((variable) => (
                    <Button
                      key={variable.key}
                      variant="outline"
                      size="sm"
                      onClick={() => handleInsertVariable(variable.key)}
                      title={variable.description}
                    >
                      <SparkleIcon size={12} className="mr-1" />
                      {variable.key}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Kliknite za vstavitev spremenljivke v vsebino.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Prekliči
            </Button>
            <Button onClick={handleSave}>
              <CheckCircleIcon size={16} className="mr-2" />
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Predogled e-pošte</DialogTitle>
            <DialogDescription>
              Tako bo videti e-pošta s pravimi podatki.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              {/* Email preview */}
              <div className="rounded-lg border">
                <div className="border-b bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Zadeva:</strong> {selectedTemplate.subject.replace(/\{\{(\w+)\}\}/g, "[...]").replace("[serviceName]", "Striženje").replace("[customerName]", "Janez Novak")}
                  </p>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedTemplate.body
                      .replace(/\{\{customerName\}\}/g, "Janez Novak")
                      .replace(/\{\{serviceName\}\}/g, "Striženje")
                      .replace(/\{\{date\}\}/g, "15. november 2026")
                      .replace(/\{\{time\}\}/g, "14:30")
                      .replace(/\{\{staffName\}\}/g, "Ana Novak")
                      .replace(/\{\{price\}\}/g, "25")
                      .replace(/\{\{businessName\}\}/g, "MARKEC")
                      .replace(/\{\{bookingLink\}\}/g, "https://markec.si/booking")
                      .replace(/\{\{reviewLink\}\}/g, "https://markec.si/review")
                      .replace(/\{\{promoCode\}\}/g, "ROJSTNIDAN10")}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowPreview(false)}>Zapri</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}