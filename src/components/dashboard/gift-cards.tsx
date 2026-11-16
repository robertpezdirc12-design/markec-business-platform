"use client"

// ============================================================
// GIFT CARDS (Fresha-inspired 2026-11-15)
// Sell and manage gift cards/vouchers.
// Like Fresha's "Gift Cards" feature — popular for gifting.
// ============================================================

import { useState, useCallback } from "react"
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
  PlusIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CopyIcon,
  CheckCircleIcon,
} from "@/components/icons"
import { Gift as GiftIcon } from "@phosphor-icons/react/dist/ssr"

interface GiftCard {
  id: string
  code: string
  value: number
  balance: number
  recipientName?: string | null
  recipientEmail?: string | null
  senderName?: string | null
  message?: string | null
  expiresAt: string
  isActive: boolean
  createdAt: string
}

interface GiftCardsProps {
  initialCards?: GiftCard[]
}

const presetAmounts = [25, 50, 75, 100, 150, 200]

function GiftCardDesign({ card }: { card: GiftCard }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white">
      {/* Decorative elements */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-white/10" />

      {/* Content */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <GiftIcon size={32} />
            <p className="mt-2 text-sm opacity-80">Darilni bon</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{card.balance} €</p>
            {card.value !== card.balance && (
              <p className="text-xs opacity-70">od {card.value} €</p>
            )}
          </div>
        </div>

        {/* Code */}
        <div className="mt-4 rounded-lg bg-white/20 px-3 py-2">
          <p className="text-xs opacity-70">Koda</p>
          <p className="font-mono text-lg font-bold tracking-wider">{card.code}</p>
        </div>

        {/* Recipient */}
        {card.recipientName && (
          <div className="mt-3">
            <p className="text-xs opacity-70">Za</p>
            <p className="font-medium">{card.recipientName}</p>
          </div>
        )}

        {/* Expiry */}
        <div className="mt-3 flex items-center justify-between text-xs opacity-70">
          <span>Velja do: {card.expiresAt}</span>
          {!card.isActive && (
            <Badge variant="secondary" className="bg-white/20 text-white">
              Uporabljeno
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function GiftCards({ initialCards = [] }: GiftCardsProps) {
  const [cards, setCards] = useState<GiftCard[]>(initialCards)
  const [open, setOpen] = useState(false)

  // Form state
  const [amount, setAmount] = useState(50)
  const [customAmount, setCustomAmount] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [senderName, setSenderName] = useState("")
  const [message, setMessage] = useState("")

  const resetForm = useCallback(() => {
    setAmount(50)
    setCustomAmount("")
    setRecipientName("")
    setRecipientEmail("")
    setSenderName("")
    setMessage("")
  }, [])

  const handleCreate = useCallback(() => {
    const finalAmount = customAmount ? Number(customAmount) : amount
    
    if (!finalAmount || finalAmount < 10) {
      toast.error("Minimalna vrednost je 10 €")
      return
    }

    const newCard: GiftCard = {
      id: `gc-${Date.now()}`,
      code: `GIFT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      value: finalAmount,
      balance: finalAmount,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      senderName: senderName || null,
      message: message || null,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      isActive: true,
      createdAt: new Date().toISOString().split("T")[0],
    }

    setCards((prev) => [newCard, ...prev])
    setOpen(false)
    resetForm()
    toast.success(`Darilni bon ${newCard.code} ustvarjen!`)
  }, [customAmount, amount, recipientName, recipientEmail, senderName, message, resetForm])

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Koda kopirana!")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Darilni boni</h2>
          <p className="text-muted-foreground">
            Ustvarite in upravljajte darilne bone.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon size={16} className="mr-2" />
              Nov darilni bon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GiftIcon size={20} />
                Nov darilni bon
              </DialogTitle>
              <DialogDescription>
                Ustvarite darilni bon za stranko.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Amount presets */}
              <div>
                <Label>Vrednost</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {presetAmounts.map((preset) => (
                    <Button
                      key={preset}
                      variant={amount === preset && !customAmount ? "default" : "outline"}
                      onClick={() => {
                        setAmount(preset)
                        setCustomAmount("")
                      }}
                    >
                      {preset} €
                    </Button>
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    type="number"
                    placeholder="Poljuben znesek"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min={10}
                  />
                </div>
              </div>

              {/* Recipient */}
              <div>
                <Label>Prejemnik (izbirno)</Label>
                <Input
                  placeholder="Ime prejemnika"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>

              <div>
                <Label>E-pošta prejemnika (izbirno)</Label>
                <Input
                  type="email"
                  placeholder="primer@email.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              {/* Sender */}
              <div>
                <Label>Vaše ime (izbirno)</Label>
                <Input
                  placeholder="Ime pošiljatelja"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>

              {/* Message */}
              <div>
                <Label>Sporočilo (izbirno)</Label>
                <Input
                  placeholder="Osebno sporočilo..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <Button onClick={handleCreate}>
                Ustvari darilni bon
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Gift Cards Grid */}
      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GiftIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Še ni darilnih bonov. Ustvarite prvega!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="space-y-3">
              <GiftCardDesign card={card} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleCopyCode(card.code)}
                >
                  <CopyIcon size={14} className="mr-1" />
                  Kopiraj kodo
                </Button>
                <Button variant="outline" size="sm">
                  Podrobnosti
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
