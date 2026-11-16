"use client"

// ============================================================
// CLIENT INTAKE FORMS (Fresha-inspired 2026-11-15)
// Custom intake forms for new clients.
// Like Fresha's "Forms" — collect client info before visit.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  FileTextIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  CheckCircleIcon,
} from "@/components/icons"
import { Clipboard as ClipboardIcon } from "@phosphor-icons/react/dist/ssr"

interface FormField {
  id: string
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "date" | "number"
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
}

interface IntakeForm {
  id: string
  name: string
  description: string
  fields: FormField[]
  isActive: boolean
  responseCount: number
  createdAt: string
}

interface IntakeFormsProps {
  initialForms?: IntakeForm[]
}

const defaultForms: IntakeForm[] = [
  {
    id: "welcome",
    name: "Obrazec za nove stranke",
    description: "Osnovni podatki in zdravstvene informacije",
    isActive: true,
    responseCount: 45,
    createdAt: "2026-11-01",
    fields: [
      { id: "1", type: "text", label: "Polno ime", required: true },
      { id: "2", type: "date", label: "Datum rojstva", required: true },
      { id: "3", type: "textarea", label: "Zdravstvene omejitve / alergije", required: false },
      { id: "4", type: "checkbox", label: "Strinjam se s pogoji uporabe", required: true },
    ],
  },
  {
    id: "medical",
    name: "Zdravstveni vprašalnik",
    description: "Pred prvim tretmajem",
    isActive: true,
    responseCount: 32,
    createdAt: "2026-11-05",
    fields: [
      { id: "1", type: "radio", label: "Ali imate kakršnekoli alergije?", required: true, options: ["Da", "Ne"] },
      { id: "2", type: "textarea", label: "Če da, katere?", required: false },
      { id: "3", type: "checkbox", label: "Ali jemljete zdravila?", required: true },
    ],
  },
]

function FormFieldPreview({ field }: { field: FormField }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </p>
          <Badge variant="outline" className="mt-1 text-xs">
            {field.type}
          </Badge>
        </div>
      </div>
      {field.options && (
        <div className="mt-2 flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <Badge key={opt} variant="secondary">
              {opt}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function IntakeForms({ initialForms = defaultForms }: IntakeFormsProps) {
  const [forms, setForms] = useState<IntakeForm[]>(initialForms)

  const toggleActive = (id: string) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isActive: !f.isActive } : f))
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Obrazci za stranke</h2>
          <p className="text-muted-foreground">
            Zbirajte informacije pred obiskom.
          </p>
        </div>
        <Button>
          <PlusIcon size={16} className="mr-2" />
          Nov obrazec
        </Button>
      </div>

      {/* Forms List */}
      <div className="space-y-4">
        {forms.map((form) => (
          <Card key={form.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileTextIcon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{form.name}</CardTitle>
                      {!form.isActive && (
                        <Badge variant="secondary">Neaktiven</Badge>
                      )}
                    </div>
                    <CardDescription>{form.description}</CardDescription>
                    <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ClipboardIcon size={14} />
                        {form.fields.length} polj
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircleIcon size={14} />
                        {form.responseCount} odgovorov
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={() => toggleActive(form.id)}
                  />
                  <Button variant="outline" size="sm">
                    Uredi
                  </Button>
                  <Button variant="outline" size="sm">
                    <CopyIcon size={14} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Fields Preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Polja:</p>
                {form.fields.map((field) => (
                  <FormFieldPreview key={field.id} field={field} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardIcon size={20} />
            Nasveti za obrazce
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="font-medium">✅ Kaj vključiti</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Osebni podatki (ime, telefon, e-pošta)</li>
                <li>• Zdravstvene omejitve / alergije</li>
                <li>• Strinjanje s pogoji (GDPR)</li>
                <li>• Preference / posebne želje</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-medium">⚡ Najboljše prakse</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Kratek obrazec = višja stopnja izpolnitve</li>
                <li>• Jasna navodila pri vsakem polju</li>
                <li>• Obvezna polja označite z *</li>
                <li>• Redno preverjajte odgovore</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
