"use client"

// ============================================================
// CLIENT IMPORT (Fresha-inspired 2026-11-15)
// Import customers from CSV file.
// Map columns, validate data, preview before import.
// ============================================================

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  
  
  
  
  
  
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  UploadIcon,
  FileTextIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  
  DownloadIcon,
} from "@/components/icons"

interface ImportColumn {
  csvColumn: string
  targetField: string
  sampleValue: string
}

interface ImportPreview {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicates: number
  errors: string[]
}

const targetFields = [
  { value: "name", label: "Ime in priimek *", required: true },
  { value: "email", label: "E-pošta", required: false },
  { value: "phone", label: "Telefon", required: false },
  { value: "notes", label: "Opombe", required: false },
  { value: "tags", label: "Oznake", required: false },
  { value: "birthday", label: "Rojstni datum", required: false },
  { value: "address", label: "Naslov", required: false },
  { value: "city", label: "Mesto", required: false },
  { value: "skip", label: "- Preskoči -", required: false },
]

export function ClientImport() {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [columns, setColumns] = useState<ImportColumn[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Prosimo izberite CSV datoteko")
      return
    }

    setFile(selectedFile)
    
    // Simulate reading CSV headers
    setTimeout(() => {
      setColumns([
        { csvColumn: "Ime", targetField: "name", sampleValue: "Janez Novak" },
        { csvColumn: "Email", targetField: "email", sampleValue: "janez@email.com" },
        { csvColumn: "Telefon", targetField: "phone", sampleValue: "041 234 567" },
        { csvColumn: "Opomba", targetField: "notes", sampleValue: "VIP stranka" },
      ])
      setStep("map")
    }, 500)
  }

  const handleMapColumn = (csvColumn: string, targetField: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.csvColumn === csvColumn ? { ...col, targetField } : col
      )
    )
  }

  const handlePreview = () => {
    // Validate that name is mapped
    const hasName = columns.some((col) => col.targetField === "name")
    if (!hasName) {
      toast.error("Polje 'Ime' je obvezno")
      return
    }

    // Simulate preview
    setPreview({
      totalRows: 150,
      validRows: 142,
      invalidRows: 5,
      duplicates: 3,
      errors: [
        "Vrstica 45: Manjka ime",
        "Vrstica 78: Neveljaven e-poštni naslov",
        "Vrstica 92: Neveljavna telefonska številka",
      ],
    })
    setStep("preview")
  }

  const handleImport = async () => {
    setImporting(true)
    setStep("importing")
    
    // Simulate import
    await new Promise((resolve) => setTimeout(resolve, 3000))
    
    setImportedCount(preview?.validRows || 0)
    setStep("done")
    toast.success(`Uspešno uvoženih ${preview?.validRows} strank!`)
  }

  const handleReset = () => {
    setStep("upload")
    setFile(null)
    setColumns([])
    setPreview(null)
    setImportedCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon size={20} />
              Uvoz strank
            </CardTitle>
            <CardDescription>
              Uvozite stranke iz CSV datoteke.
            </CardDescription>
          </div>
          {step === "done" && (
            <Button variant="outline" onClick={handleReset}>
              Nov uvoz
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-between">
          {["upload", "map", "preview", "done"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["upload", "map", "preview", "done"].indexOf(step) > i
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`mx-2 h-0.5 w-12 ${
                    ["upload", "map", "preview", "done"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* UPLOAD STEP */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="rounded-lg border-2 border-dashed p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const droppedFile = e.dataTransfer.files[0]
                if (droppedFile?.name.endsWith(".csv")) {
                  setFile(droppedFile)
                  setStep("map")
                }
              }}
            >
              <FileTextIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="mb-2 font-semibold">Naložite CSV datoteko</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Povlecite datoteko sem ali kliknite za izbiro
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <UploadIcon size={16} className="mr-2" />
                Izberi datoteko
              </Button>
            </div>

            {/* Template download */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Potrebujete predlogo?</p>
                  <p className="text-sm text-muted-foreground">
                    Prenesite vzorčno CSV datoteko s pravilnimi stolpci.
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <DownloadIcon size={14} className="mr-2" />
                  Prenesi predlogo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MAP STEP */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm">
                <strong>Datoteka:</strong> {file?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Najdenih {columns.length} stolpcev
              </p>
            </div>

            <div className="space-y-3">
              <Label>Preslikava stolpcev</Label>
              {columns.map((col) => (
                <div
                  key={col.csvColumn}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium">{col.csvColumn}</p>
                    <p className="text-xs text-muted-foreground">
                      Primer: {col.sampleValue}
                    </p>
                  </div>
                  <div className="w-[200px]">
                    <Select
                      value={col.targetField}
                      onValueChange={(value) => handleMapColumn(col.csvColumn, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {targetFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Nazaj
              </Button>
              <Button onClick={handlePreview}>Predogled →</Button>
            </div>
          </div>
        )}

        {/* PREVIEW STEP */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{preview.totalRows}</p>
                <p className="text-sm text-blue-600">Skupaj vrstic</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{preview.validRows}</p>
                <p className="text-sm text-green-600">Veljavnih</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{preview.invalidRows}</p>
                <p className="text-sm text-red-600">Napačnih</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{preview.duplicates}</p>
                <p className="text-sm text-amber-600">Podvojenih</p>
              </div>
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <WarningCircleIcon size={18} className="text-red-500" />
                  <p className="font-medium text-red-800">Napake pri uvozu</p>
                </div>
                <ul className="mt-2 space-y-1">
                  {preview.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-700">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Nazaj
              </Button>
              <Button onClick={handleImport}>
                Uvozi {preview.validRows} strank
              </Button>
            </div>
          </div>
        )}

        {/* IMPORTING STEP */}
        {step === "importing" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <h3 className="mb-2 font-semibold">Uvažam stranke...</h3>
            <p className="text-muted-foreground">
              Prosimo počakajte, uvoz lahko traja nekaj minut.
            </p>
          </div>
        )}

        {/* DONE STEP */}
        {step === "done" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircleIcon size={32} className="text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Uvoz končan!</h3>
            <p className="mb-6 text-muted-foreground">
              Uspešno uvoženih <strong>{importedCount}</strong> strank.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleReset}>
                Nov uvoz
              </Button>
              <Button onClick={() => window.location.reload()}>
                Prikaži stranke
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}