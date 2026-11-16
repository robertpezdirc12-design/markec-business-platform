"use client"

// ============================================================
// DATA CONNECTOR (Fresha-inspired 2026-11-15)
// Export business data for BI tools (Excel, Google Sheets, Power BI).
// Scheduled exports, custom reports, API access.
// Like Fresha's "Data connector" — data-driven decisions.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  DownloadIcon,
  FileTextIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@/components/icons"
import { Link as LinkIcon } from "@phosphor-icons/react/dist/ssr"

interface ExportJob {
  id: string
  name: string
  dataType: "appointments" | "customers" | "services" | "products" | "orders" | "revenue"
  format: "csv" | "excel" | "json"
  frequency: "manual" | "daily" | "weekly" | "monthly"
  lastExported?: string | null
  isActive: boolean
  recordCount: number
}

interface DataConnectorProps {
  initialExports?: ExportJob[]
}

const defaultExports: ExportJob[] = [
  {
    id: "exp-1",
    name: "Mesečni prihodki",
    dataType: "revenue",
    format: "excel",
    frequency: "monthly",
    lastExported: "2026-11-01",
    isActive: true,
    recordCount: 1250,
  },
  {
    id: "exp-2",
    name: "Tedenski termini",
    dataType: "appointments",
    format: "csv",
    frequency: "weekly",
    lastExported: "2026-11-11",
    isActive: true,
    recordCount: 340,
  },
  {
    id: "exp-3",
    name: "Seznam strank",
    dataType: "customers",
    format: "csv",
    frequency: "manual",
    lastExported: null,
    isActive: false,
    recordCount: 285,
  },
  {
    id: "exp-4",
    name: "Prodaja izdelkov",
    dataType: "products",
    format: "excel",
    frequency: "monthly",
    lastExported: "2026-11-01",
    isActive: true,
    recordCount: 89,
  },
]

const dataTypeConfig = {
  appointments: { label: "Termini", icon: <CalendarIcon size={16} />, color: "bg-blue-100 text-blue-800" },
  customers: { label: "Stranke", icon: <UsersIcon size={16} />, color: "bg-green-100 text-green-800" },
  services: { label: "Storitve", icon: <FileTextIcon size={16} />, color: "bg-purple-100 text-purple-800" },
  products: { label: "Izdelki", icon: <ShoppingBagIcon size={16} />, color: "bg-amber-100 text-amber-800" },
  orders: { label: "Naročila", icon: <FileTextIcon size={16} />, color: "bg-orange-100 text-orange-800" },
  revenue: { label: "Prihodki", icon: <CurrencyDollarIcon size={16} />, color: "bg-green-100 text-green-800" },
}

const frequencyLabels = {
  manual: "Ročno",
  daily: "Dnevno",
  weekly: "Tedensko",
  monthly: "Mesečno",
}

export function DataConnector({ initialExports = defaultExports }: DataConnectorProps) {
  const [exports, setExports] = useState<ExportJob[]>(initialExports)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showApiDialog, setShowApiDialog] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  // New export form
  const [newExportName, setNewExportName] = useState("")
  const [newExportType, setNewExportType] = useState<ExportJob["dataType"]>("appointments")
  const [newExportFormat, setNewExportFormat] = useState<ExportJob["format"]>("csv")
  const [newExportFrequency, setNewExportFrequency] = useState<ExportJob["frequency"]>("manual")

  const handleExport = async (exportId: string) => {
    setExporting(exportId)
    
    // Simulate export
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    setExports((prev) =>
      prev.map((e) =>
        e.id === exportId
          ? { ...e, lastExported: new Date().toISOString().split("T")[0] }
          : e
      )
    )
    setExporting(null)
    toast.success("Izvoz končan! Prenesite datoteko.")
  }

  const handleAddExport = () => {
    if (!newExportName.trim()) {
      toast.error("Vnesite ime izvoza")
      return
    }

    const newExport: ExportJob = {
      id: `exp-${Date.now()}`,
      name: newExportName,
      dataType: newExportType,
      format: newExportFormat,
      frequency: newExportFrequency,
      lastExported: null,
      isActive: true,
      recordCount: Math.floor(Math.random() * 1000) + 50,
    }

    setExports((prev) => [...prev, newExport])
    setShowAddDialog(false)
    setNewExportName("")
    toast.success("Izvoz ustvarjen")
  }

  const handleToggle = (id: string) => {
    setExports((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e))
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Podatkovni priključek</h2>
          <p className="text-muted-foreground">
            Izvozite podatke za analizo v Excelu, Power BI, Google Sheets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowApiDialog(true)}>
            <LinkIcon size={16} className="mr-2" />
            API dostop
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <DownloadIcon size={16} className="mr-2" />
            Nov izvoz
          </Button>
        </div>
      </div>

      {/* Quick Export Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500 p-2 text-white">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <p className="font-medium">Termini</p>
                  <p className="text-sm text-muted-foreground">340 zapisov</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("quick-appointments")}>
                <DownloadIcon size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500 p-2 text-white">
                  <UsersIcon size={18} />
                </div>
                <div>
                  <p className="font-medium">Stranke</p>
                  <p className="text-sm text-muted-foreground">285 zapisov</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("quick-customers")}>
                <DownloadIcon size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500 p-2 text-white">
                  <CurrencyDollarIcon size={18} />
                </div>
                <div>
                  <p className="font-medium">Prihodki</p>
                  <p className="text-sm text-muted-foreground">1.250 zapisov</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport("quick-revenue")}>
                <DownloadIcon size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon size={20} />
            Načrtovani izvozi
          </CardTitle>
          <CardDescription>
            Samodejni izvozi podatkov po urniku.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exports.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-2 ${dataTypeConfig[exp.dataType].color}`}>
                    {dataTypeConfig[exp.dataType].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{exp.name}</p>
                      <Badge variant="outline">{exp.format.toUpperCase()}</Badge>
                      <Badge variant="secondary">{frequencyLabels[exp.frequency]}</Badge>
                      {!exp.isActive && <Badge variant="secondary">Neaktivno</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{dataTypeConfig[exp.dataType].label}</span>
                      <span>•</span>
                      <span>{exp.recordCount} zapisov</span>
                      <span>•</span>
                      <span>
                        {exp.lastExported
                          ? `Zadnjič: ${exp.lastExported}`
                          : "Še ni izvoženo"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={exp.isActive}
                    onCheckedChange={() => handleToggle(exp.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(exp.id)}
                    disabled={exporting === exp.id}
                  >
                    <DownloadIcon size={14} className="mr-1" />
                    {exporting === exp.id ? "Izvažam..." : "Izvozi"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Partners */}
      <Card>
        <CardHeader>
          <CardTitle>Podprte integracije</CardTitle>
          <CardDescription>
            Izvožene podatke uporabite v priljubljenih orodjih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Microsoft Excel", format: "XLSX", color: "bg-green-600" },
              { name: "Google Sheets", format: "CSV", color: "bg-blue-600" },
              { name: "Power BI", format: "XLSX/JSON", color: "bg-amber-500" },
              { name: "Tableau", format: "CSV/JSON", color: "bg-blue-500" },
            ].map((tool) => (
              <div key={tool.name} className="flex items-center gap-3 rounded-lg border p-3">
                <div className={`${tool.color} flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold`}>
                  {tool.name[0]}
                </div>
                <div>
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.format}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Export Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nov izvoz podatkov</DialogTitle>
            <DialogDescription>
              Konfigurirajte samodejni izvoz podatkov.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ime izvoza</Label>
              <Input
                value={newExportName}
                onChange={(e) => setNewExportName(e.target.value)}
                placeholder="npr. Tedenski prihodki"
              />
            </div>

            <div>
              <Label>Tip podatkov</Label>
              <Select value={newExportType} onValueChange={(v: any) => setNewExportType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointments">Termini</SelectItem>
                  <SelectItem value="customers">Stranke</SelectItem>
                  <SelectItem value="services">Storitve</SelectItem>
                  <SelectItem value="products">Izdelki</SelectItem>
                  <SelectItem value="orders">Naročila</SelectItem>
                  <SelectItem value="revenue">Prihodki</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Format</Label>
              <Select value={newExportFormat} onValueChange={(v: any) => setNewExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel (XLSX)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pogostost</Label>
              <Select value={newExportFrequency} onValueChange={(v: any) => setNewExportFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Ročno</SelectItem>
                  <SelectItem value="daily">Dnevno</SelectItem>
                  <SelectItem value="weekly">Tedensko</SelectItem>
                  <SelectItem value="monthly">Mesečno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Prekliči
            </Button>
            <Button onClick={handleAddExport}>
              Ustvari izvoz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Dialog */}
      <Dialog open={showApiDialog} onOpenChange={setShowApiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API dostop</DialogTitle>
            <DialogDescription>
              Dostopajte do podatkov prek REST API-ja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="mb-2 text-sm font-medium">API ključ:</p>
              <code className="block rounded bg-black p-2 text-xs text-green-400">
                mk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
              </code>
              <Button variant="outline" size="sm" className="mt-2">
                Kopiraj ključ
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Primer uporabe:</p>
              <code className="block rounded bg-black p-3 text-xs text-gray-300">
                {`curl -H "Authorization: Bearer mk_live_..." \\
  https://api.markec.si/v1/appointments`}
              </code>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
              <CheckCircleIcon size={18} className="text-blue-500" />
              <p className="text-sm text-blue-800">
                API dokumentacija: <a href="#" className="underline">docs.markec.si/api</a>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiDialog(false)}>
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}