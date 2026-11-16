"use client"

// ============================================================
// SMART PRICING (Fresha-inspired 2026-11-15)
// Dynamic pricing rules: peak hours, seasonal, loyalty.
// Like Fresha's "Smart pricing" — optimize revenue.
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
  TrendingUpIcon,
  ClockIcon,
  CalendarIcon,
  StarIcon,
  PlusIcon,
  CurrencyDollarIcon,
} from "@/components/icons"

interface PricingRule {
  id: string
  name: string
  type: "peak-hours" | "seasonal" | "loyalty" | "last-minute" | "early-bird"
  adjustment: number // percentage (+/-)
  conditions: {
    days?: string[]
    hours?: { start: string; end: string }
    months?: number[]
    loyaltyTier?: string
    daysBefore?: number
  }
  isActive: boolean
  usageCount: number
}

interface SmartPricingProps {
  initialRules?: PricingRule[]
}

const defaultRules: PricingRule[] = [
  {
    id: "peak-hours",
    name: "Vrhunec ure (petek/sobota)",
    type: "peak-hours",
    adjustment: 15,
    conditions: {
      days: ["friday", "saturday"],
      hours: { start: "14:00", end: "18:00" },
    },
    isActive: true,
    usageCount: 45,
  },
  {
    id: "early-bird",
    name: "Zgodnja ura (zjutraj)",
    type: "early-bird",
    adjustment: -10,
    conditions: {
      hours: { start: "09:00", end: "11:00" },
    },
    isActive: true,
    usageCount: 23,
  },
  {
    id: "loyalty-discount",
    name: "Popust za zveste stranke",
    type: "loyalty",
    adjustment: -15,
    conditions: {
      loyaltyTier: "gold",
    },
    isActive: true,
    usageCount: 67,
  },
  {
    id: "last-minute",
    name: "Zadnja minuta (24h)",
    type: "last-minute",
    adjustment: -20,
    conditions: {
      daysBefore: 1,
    },
    isActive: false,
    usageCount: 12,
  },
]

const typeLabels = {
  "peak-hours": { label: "Vrhunec ure", icon: <ClockIcon size={16} />, color: "bg-red-100 text-red-800" },
  seasonal: { label: "Sezonsko", icon: <CalendarIcon size={16} />, color: "bg-blue-100 text-blue-800" },
  loyalty: { label: "Zvestoba", icon: <StarIcon size={16} />, color: "bg-amber-100 text-amber-800" },
  "last-minute": { label: "Zadnja minuta", icon: <ClockIcon size={16} />, color: "bg-green-100 text-green-800" },
  "early-bird": { label: "Zgodnja ura", icon: <ClockIcon size={16} />, color: "bg-purple-100 text-purple-800" },
}

export function SmartPricing({ initialRules = defaultRules }: SmartPricingProps) {
  const [rules, setRules] = useState<PricingRule[]>(initialRules)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null)

  // New rule form
  const [newRuleName, setNewRuleName] = useState("")
  const [newRuleType, setNewRuleType] = useState<PricingRule["type"]>("peak-hours")
  const [newRuleAdjustment, setNewRuleAdjustment] = useState(10)

  const handleToggle = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    )
  }

  const handleAddRule = () => {
    if (!newRuleName.trim()) {
      toast.error("Vnesite ime pravila")
      return
    }

    const newRule: PricingRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName,
      type: newRuleType,
      adjustment: newRuleAdjustment,
      conditions: {},
      isActive: true,
      usageCount: 0,
    }

    setRules((prev) => [...prev, newRule])
    setShowAddDialog(false)
    setNewRuleName("")
    setNewRuleType("peak-hours")
    setNewRuleAdjustment(10)
    toast.success("Pravilo dodano")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pametne cene</h2>
          <p className="text-muted-foreground">
            Dinamične cene glede na povpraševanje, čas in zvestobo.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <PlusIcon size={16} className="mr-2" />
          Novo pravilo
        </Button>
      </div>

      {/* Pricing Rules */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-2 ${typeLabels[rule.type].color}`}>
                    {typeLabels[rule.type].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <Badge variant="outline">{typeLabels[rule.type].label}</Badge>
                      {!rule.isActive && <Badge variant="secondary">Neaktivno</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className={`font-medium ${rule.adjustment > 0 ? "text-red-600" : "text-green-600"}`}>
                        {rule.adjustment > 0 ? "+" : ""}{rule.adjustment}%
                      </span>
                      <span>•</span>
                      <span>{rule.usageCount} uporab</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => handleToggle(rule.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    Uredi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pricing Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon size={20} />
            Primeri dinamičnih cen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Osnovna cena storitve</p>
                  <p className="text-sm text-muted-foreground">Striženje in oblikovanje</p>
                </div>
                <p className="text-xl font-bold">25 €</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Z dinamičnimi cenami:</p>
              
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} className="text-red-500" />
                  <span className="text-sm">Petek 15:00 (vrhunec)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-medium">+15%</span>
                  <span className="font-bold">28,75 €</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} className="text-green-500" />
                  <span className="text-sm">Torek 09:00 (zgodnja ura)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-medium">-10%</span>
                  <span className="font-bold">22,50 €</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <StarIcon size={16} className="text-amber-500" />
                  <span className="text-sm">Zlata stranka</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-medium">-15%</span>
                  <span className="font-bold">21,25 €</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo pravilo za ceno</DialogTitle>
            <DialogDescription>
              Ustvarite pravilo za dinamično prilagajanje cen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ime pravila</Label>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="npr. Popust za zgodnje jutro"
              />
            </div>

            <div>
              <Label>Vrsta</Label>
              <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as "loyalty" | "peak-hours" | "seasonal" | "last-minute" | "early-bird")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peak-hours">Vrhunec ure</SelectItem>
                  <SelectItem value="seasonal">Sezonsko</SelectItem>
                  <SelectItem value="loyalty">Zvestoba</SelectItem>
                  <SelectItem value="last-minute">Zadnja minuta</SelectItem>
                  <SelectItem value="early-bird">Zgodnja ura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prilagoditev cene (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={newRuleAdjustment}
                  onChange={(e) => setNewRuleAdjustment(Number(e.target.value))}
                  min={-50}
                  max={100}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewRuleAdjustment(-10)}
                  >
                    -10%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewRuleAdjustment(10)}
                  >
                    +10%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewRuleAdjustment(20)}
                  >
                    +20%
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Negativno = popust, Pozitivno = doplačilo
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Prekliči
            </Button>
            <Button onClick={handleAddRule}>
              Dodaj pravilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}