"use client"

// ============================================================
// CLIENT PROFILE CARD 360° (Fresha-inspired 2026-11-15)
// Complete customer view with tags, notes, and history.
// Shows marketing consent, visit history, and client value.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  UserIcon,
  TagIcon,
  StarIcon,
  TrendingUpIcon,
  ClockIcon,
  EnvelopeIcon,
  WarningCircleIcon,
} from "@/components/icons"

interface ClientProfileCardProps {
  customer: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    notes?: string | null
    tags: string[]
    marketingConsent: boolean
    marketingUnsubscribe: boolean
    createdAt: Date | string
    lastVisit?: Date | string | null
    totalVisits?: number
    totalSpent?: number
    averageVisitValue?: number
  }
  onNotesSave?: (notes: string) => void
  onTagAdd?: (tag: string) => void
  onTagRemove?: (tag: string) => void
}

// Predefined tag suggestions (like Fresha)
const tagSuggestions = [
  "VIP",
  "Redna stranka",
  "Novinka",
  "Priporočilo",
  "Obožuje popuste",
  "Rojstni dan",
  "Obletnica",
]

export function ClientProfileCard({
  customer,
  onNotesSave,
  onTagAdd,
  onTagRemove,
}: ClientProfileCardProps) {
  const [notes, setNotes] = useState(customer.notes || "")
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [newTag, setNewTag] = useState("")
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  const handleSaveNotes = () => {
    onNotesSave?.(notes)
    setIsEditingNotes(false)
    toast.success("Opombe shranjene")
  }

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return
    if (customer.tags.includes(tag.trim())) {
      toast.error("Oznaka že obstaja")
      return
    }
    onTagAdd?.(tag.trim())
    setNewTag("")
    setShowTagSuggestions(false)
    toast.success("Oznaka dodana")
  }

  const handleRemoveTag = (tag: string) => {
    onTagRemove?.(tag)
    toast.success("Oznaka odstranjena")
  }

  // Calculate visit frequency
  const memberSince = new Date(customer.createdAt)
  const [now] = useState(() => Date.now())
  const daysSinceMember = useMemo(() => Math.floor(
    (now - memberSince.getTime()) / (1000 * 60 * 60 * 24)
  ), [memberSince, now])
  const visitFrequency =
    customer.totalVisits && daysSinceMember > 0
      ? Math.round(daysSinceMember / customer.totalVisits)
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon size={20} />
          Profil stranke 360°
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Value Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <TrendingUpIcon size={20} className="mx-auto mb-1 text-green-600" />
            <p className="text-lg font-bold text-green-700">
              {customer.totalSpent ? `${customer.totalSpent} €` : "0 €"}
            </p>
            <p className="text-xs text-green-600">Skupaj porabljeno</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <ClockIcon size={20} className="mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-bold text-blue-700">
              {customer.totalVisits || 0}
            </p>
            <p className="text-xs text-blue-600">Obiskov</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 text-center">
            <StarIcon size={20} className="mx-auto mb-1 text-purple-600" />
            <p className="text-lg font-bold text-purple-700">
              {customer.averageVisitValue
                ? `${customer.averageVisitValue} €`
                : "—"}
            </p>
            <p className="text-xs text-purple-600">Povprečje</p>
          </div>
        </div>

        {/* Visit Frequency Insight */}
        {visitFrequency && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              <strong>Pogostost obiskov:</strong> približno vsakih{" "}
              <strong>{visitFrequency} dni</strong>
              {visitFrequency < 30 && (
                <Badge variant="outline" className="ml-2 text-green-600">
                  Aktivna stranka
                </Badge>
              )}
            </p>
          </div>
        )}

        <Separator />

        {/* Tags / Oznake */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TagIcon size={18} className="text-muted-foreground" />
              <span className="font-medium">Oznake</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagSuggestions(!showTagSuggestions)}
            >
              + Dodaj oznako
            </Button>
          </div>

          {/* Current tags */}
          <div className="flex flex-wrap gap-2">
            {customer.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ni oznak</p>
            ) : (
              customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-red-500"
                    title="Odstrani oznako"
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </div>

          {/* Tag suggestions */}
          {showTagSuggestions && (
            <div className="mt-3 rounded-lg border p-3">
              <p className="mb-2 text-sm text-muted-foreground">Predlogi:</p>
              <div className="flex flex-wrap gap-2">
                {tagSuggestions
                  .filter((t) => !customer.tags.includes(t))
                  .map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTag(tag)}
                    >
                      {tag}
                    </Button>
                  ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Lastna oznaka..."
                  className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTag(newTag)
                    }
                  }}
                />
                <Button size="sm" onClick={() => handleAddTag(newTag)}>
                  Dodaj
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Notes / Opombe */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StarIcon size={18} className="text-muted-foreground" />
              <span className="font-medium">Interne opombe</span>
            </div>
            {!isEditingNotes && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingNotes(true)}
              >
                {notes ? "Uredi" : "Dodaj opombo"}
              </Button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodajte interne opombe o stranki (npr. preference, alergije, posebne želje)..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes}>
                  Shrani
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotes(customer.notes || "")
                    setIsEditingNotes(false)
                  }}
                >
                  Prekliči
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3">
              {notes ? (
                <p className="text-sm whitespace-pre-wrap">{notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Ni opomb. Kliknite &quot;Dodaj opombo&quot; za beleženje informacij o
                  stranki.
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Marketing Status */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <EnvelopeIcon size={18} className="text-muted-foreground" />
            <span className="font-medium">Marketinška privolitev</span>
          </div>

          <div className="space-y-2">
            {customer.marketingUnsubscribe ? (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3">
                <WarningCircleIcon size={18} className="text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Odjavljen/a od marketinških sporočil
                  </p>
                  <p className="text-xs text-red-600">
                    Stranka ne želi prejemati promocijskih e-sporočil
                  </p>
                </div>
              </div>
            ) : customer.marketingConsent ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
                <EnvelopeIcon size={18} className="text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-700">
                    Privolil/a v marketinška sporočila
                  </p>
                  <p className="text-xs text-green-600">
                    Lahko pošiljate promocije, novice, ponudbe
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3">
                <WarningCircleIcon size={18} className="text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    Ni privolitve
                  </p>
                  <p className="text-xs text-amber-600">
                    Prosimo za privolitev pred marketinškimi kampanjami
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
