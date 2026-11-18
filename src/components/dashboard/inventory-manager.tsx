"use client"

// ============================================================
// INVENTORY MANAGER (Fresha-inspired 2026-11-15)
// Track product stock with alerts and reorder suggestions.
// Like Fresha's "Inventory" — never run out of products.
// ============================================================

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  
  WarningCircleIcon,
  PackageIcon,
  PlusIcon,
  MinusIcon,
  
} from "@/components/icons"
import { TrendDown as TrendingDownIcon } from "@phosphor-icons/react/dist/ssr"

interface InventoryItem {
  id: string
  name: string
  sku: string
  currentStock: number
  minStock: number
  maxStock: number
  price: number
  category: string
  lastRestocked?: string
}

interface InventoryManagerProps {
  items: InventoryItem[]
}

function StockLevelBadge({ current, min }: { current: number; min: number }) {
  if (current === 0) {
    return <Badge className="bg-red-500 text-white">Ni na zalogi</Badge>
  }
  if (current <= min) {
    return <Badge className="bg-amber-500 text-white">Nizka zaloga</Badge>
  }
  return <Badge className="bg-green-500 text-white">Na zalogi</Badge>
}

function StockBar({ current, min, max }: { current: number; min: number; max: number }) {
  const percentage = Math.min((current / max) * 100, 100)
  const isLow = current <= min
  
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${
          current === 0
            ? "bg-red-500"
            : isLow
              ? "bg-amber-500"
              : "bg-green-500"
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function InventoryManager({ items }: InventoryManagerProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(items)
  const [filter, setFilter] = useState("all")
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(0)

  const lowStockItems = inventory.filter((item) => item.currentStock <= item.minStock && item.currentStock > 0)
  const outOfStockItems = inventory.filter((item) => item.currentStock === 0)

  const filteredItems = inventory.filter((item) => {
    if (filter === "low") return item.currentStock <= item.minStock && item.currentStock > 0
    if (filter === "out") return item.currentStock === 0
    return true
  })

  const handleAdjustStock = (itemId: string, amount: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, currentStock: Math.max(0, item.currentStock + amount) }
          : item
      )
    )
    toast.success(`Zaloga ${amount > 0 ? "povečana" : "zmanjšana"} za ${Math.abs(amount)}`)
    setSelectedItem(null)
    setAdjustAmount(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zaloga izdelkov</h2>
          <p className="text-muted-foreground">
            Sledite zalogam in prejemajte opomnike za ponovno naročilo.
          </p>
        </div>
        <Button>
          <PlusIcon size={16} className="mr-2" />
          Nov izdelek
        </Button>
      </div>

      {/* Alerts */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="space-y-3">
          {outOfStockItems.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <WarningCircleIcon size={20} className="mt-0.5 text-red-500" />
              <div>
                <p className="font-medium text-red-800">
                  {outOfStockItems.length} izdelkov ni na zalogi
                </p>
                <p className="text-sm text-red-700">
                  Takoj naročite: {outOfStockItems.map((i) => i.name).join(", ")}
                </p>
              </div>
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <TrendingDownIcon size={20} className="mt-0.5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-800">
                  {lowStockItems.length} izdelkov ima nizko zalogo
                </p>
                <p className="text-sm text-amber-700">
                  Kmalu bodo potrebovali ponovno naročilo.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi izdelki</SelectItem>
            <SelectItem value="low">Nizka zaloga</SelectItem>
            <SelectItem value="out">Ni na zalogi</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{filteredItems.length} izdelkov</Badge>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">Izdelek</th>
                  <th className="p-4 text-left font-medium">SKU</th>
                  <th className="p-4 text-left font-medium">Zaloga</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  <th className="p-4 text-right font-medium">Cena</th>
                  <th className="p-4 text-right font-medium">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <PackageIcon size={18} />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-xs text-muted-foreground">{item.sku}</code>
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.currentStock}</span>
                          <span className="text-xs text-muted-foreground">
                            / min {item.minStock}
                          </span>
                        </div>
                        <StockBar
                          current={item.currentStock}
                          min={item.minStock}
                          max={item.maxStock}
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <StockLevelBadge current={item.currentStock} min={item.minStock} />
                    </td>
                    <td className="p-4 text-right font-semibold">
                      {item.price} €
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item)
                          setAdjustAmount(0)
                        }}
                      >
                        Prilagodi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prilagodi zalogo</DialogTitle>
            <DialogDescription>
              {selectedItem?.name} — trenutna zaloga: {selectedItem?.currentStock}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustAmount((prev) => prev - 1)}
              >
                <MinusIcon size={16} />
              </Button>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustAmount((prev) => prev + 1)}
              >
                <PlusIcon size={16} />
              </Button>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustAmount(10)}
              >
                +10
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustAmount(25)}
              >
                +25
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustAmount(50)}
              >
                +50
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustAmount(selectedItem ? selectedItem.minStock * 2 : 0)}
              >
                Dopolni zalogo
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Prekliči
            </Button>
            <Button
              onClick={() => selectedItem && handleAdjustStock(selectedItem.id, adjustAmount)}
              disabled={adjustAmount === 0}
            >
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
