"use client"

// ============================================================
// DEALS MANAGER (Fresha-inspired 2026-11-15)
// Create and manage deals/discounts like Fresha's "Deals" feature.
// Supports percentage, fixed amount, and BOGO deals.
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  TagIcon,
  PlusIcon,
  CurrencyDollarIcon,
  ClockIcon,
  TrendingUpIcon,
} from "@/components/icons"
import {
  Percent as PercentIcon,
  Gift as GiftIcon,
} from "@phosphor-icons/react/dist/ssr"

interface Deal {
  id: string
  name: string
  type: "PERCENTAGE" | "FIXED" | "BOGO"
  value: number // percentage or fixed amount
  validFrom: string
  validUntil: string
  isActive: boolean
  usageCount: number
  maxUsage?: number | null
}

interface DealsManagerProps {
  initialDeals?: Deal[]
}

const dealTypeLabels = {
  PERCENTAGE: { label: "Popust %", icon: <PercentIcon size={16} /> },
  FIXED: { label: "Fiksen popust", icon: <CurrencyDollarIcon size={16} /> },
  BOGO: { label: "Kupi 1, dobi 1", icon: <GiftIcon size={16} /> },
}

export function DealsManager({ initialDeals = [] }: DealsManagerProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [open, setOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [type, setType] = useState<"PERCENTAGE" | "FIXED" | "BOGO">("PERCENTAGE")
  const [value, setValue] = useState(10)
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0])
  const [validUntil, setValidUntil] = useState("")
  const [maxUsage, setMaxUsage] = useState<number | undefined>()

  const handleOpenNew = () => {
    setEditingDeal(null)
    setName("")
    setType("PERCENTAGE")
    setValue(10)
    setValidFrom(new Date().toISOString().split("T")[0])
    setValidUntil("")
    setMaxUsage(undefined)
    setOpen(true)
  }

  const handleOpenEdit = (deal: Deal) => {
    setEditingDeal(deal)
    setName(deal.name)
    setType(deal.type)
    setValue(deal.value)
    setValidFrom(deal.validFrom)
    setValidUntil(deal.validUntil)
    setMaxUsage(deal.maxUsage ?? undefined)
    setOpen(true)
  }

  const handleSave = () => {
    if (!name.trim() || !validUntil) {
      toast.error("Izpolnite ime in datum veljavnosti")
      return
    }

    const deal: Deal = {
      id: editingDeal?.id || `deal-${Date.now()}`,
      name,
      type,
      value,
      validFrom,
      validUntil,
      isActive: editingDeal?.isActive ?? true,
      usageCount: editingDeal?.usageCount ?? 0,
      maxUsage,
    }

    if (editingDeal) {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)))
      toast.success("Ugodnost posodobljena")
    } else {
      setDeals((prev) => [...prev, deal])
      toast.success("Ugodnost ustvarjena")
    }

    setOpen(false)
  }

  const handleToggleActive = (id: string) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: !d.isActive } : d))
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TagIcon size={20} />
              Ugodnosti in popusti
            </CardTitle>
            <CardDescription>
              Ustvarite privlačne ponudbe za stranke.
            </CardDescription>
          </div>
          <Button onClick={handleOpenNew}>
            <PlusIcon size={16} className="mr-2" />
            Nova ugodnost
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <div className="py-8 text-center">
            <TagIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Še ni ugodnosti. Ustvarite prvo ponudbo!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className={`flex items-center justify-between rounded-lg border p-4 ${
                  deal.isActive ? "bg-green-50 border-green-200" : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {dealTypeLabels[deal.type].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{deal.name}</p>
                      <Badge variant="outline">{dealTypeLabels[deal.type].label}</Badge>
                      {!deal.isActive && <Badge variant="secondary">Neaktiven</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ClockIcon size={14} />
                        {deal.validFrom} — {deal.validUntil}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUpIcon size={14} />
                        {deal.usageCount} uporab
                        {deal.maxUsage && ` / ${deal.maxUsage}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {deal.type === "PERCENTAGE"
                        ? `-${deal.value}%`
                        : deal.type === "FIXED"
                          ? `-${deal.value} €`
                          : "1+1"}
                    </p>
                  </div>
                  <Switch
                    checked={deal.isActive}
                    onCheckedChange={() => handleToggleActive(deal.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(deal)}
                  >
                    Uredi
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Deal Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Uredi ugodnost" : "Nova ugodnost"}
            </DialogTitle>
            <DialogDescription>
              Nastavite podrobnosti popusta ali ponudbe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>Ime ugodnosti</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="npr. Poletni popust 20%"
              />
            </div>

            {/* Type */}
            <div>
              <Label>Vrsta</Label>
              <Select value={type} onValueChange={(v) => setType(v as "FIXED" | "PERCENTAGE" | "BOGO")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Popust %</SelectItem>
                  <SelectItem value="FIXED">Fiksen popust (€)</SelectItem>
                  <SelectItem value="BOGO">Kupi 1, dobi 1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            {type !== "BOGO" && (
              <div>
                <Label>
                  {type === "PERCENTAGE" ? "Odstotek popusta (%)" : "Znesek popusta (€)"}
                </Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  min={1}
                  max={type === "PERCENTAGE" ? 100 : undefined}
                />
              </div>
            )}

            {/* Validity dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Velja od</Label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>Velja do</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            {/* Max usage */}
            <div>
              <Label>Max uporab (izbirno)</Label>
              <Input
                type="number"
                value={maxUsage || ""}
                onChange={(e) => setMaxUsage(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Neomejeno"
                min={1}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={handleSave}>
              {editingDeal ? "Shrani spremembe" : "Ustvari ugodnost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
