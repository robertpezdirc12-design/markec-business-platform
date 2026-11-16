"use client"

// ============================================================
// BULK ACTIONS (Fresha-inspired 2026-11-15)
// Mass actions for customers: email, tag, delete.
// Like Fresha's "Bulk actions" — save time on repetitive tasks.
// ============================================================

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  UsersIcon,
  EnvelopeIcon,
  TagIcon,
  TrashIcon,
  CloseIcon,
  CheckIcon,
} from "@/components/icons"

interface BulkActionsProps {
  selectedCount: number
  selectedIds: string[]
  onClearSelection: () => void
  onBulkEmail?: (ids: string[], subject: string, body: string) => void
  onBulkTag?: (ids: string[], tag: string) => void
  onBulkDelete?: (ids: string[]) => void
}

export function BulkActions({
  selectedCount,
  selectedIds,
  onClearSelection,
  onBulkEmail,
  onBulkTag,
  onBulkDelete,
}: BulkActionsProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Email form
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  
  // Tag form
  const [tagName, setTagName] = useState("")

  const handleBulkEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Izpolnite zadevo in vsebino")
      return
    }
    onBulkEmail?.(selectedIds, emailSubject, emailBody)
    setShowEmailDialog(false)
    setEmailSubject("")
    setEmailBody("")
    toast.success(`E-pošta poslana ${selectedCount} strankam`)
  }

  const handleBulkTag = () => {
    if (!tagName.trim()) {
      toast.error("Vnesite oznako")
      return
    }
    onBulkTag?.(selectedIds, tagName)
    setShowTagDialog(false)
    setTagName("")
    toast.success(`Oznaka "${tagName}" dodana ${selectedCount} strankam`)
  }

  const handleBulkDelete = () => {
    onBulkDelete?.(selectedIds)
    setShowDeleteDialog(false)
    toast.success(`${selectedCount} strank izbrisanih`)
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      <div className="sticky bottom-0 z-10 rounded-lg border bg-background shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CheckIcon size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-medium">
                Izbranih: <span className="text-primary">{selectedCount}</span> strank
              </p>
              <p className="text-sm text-muted-foreground">
                Izberite akcijo za masovno obdelavo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Email */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmailDialog(true)}
            >
              <EnvelopeIcon size={16} className="mr-2" />
              Pošlji e-pošto
            </Button>

            {/* Bulk Tag */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagDialog(true)}
            >
              <TagIcon size={16} className="mr-2" />
              Dodaj oznako
            </Button>

            {/* Bulk Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <TrashIcon size={16} className="mr-2" />
              Izbriši
            </Button>

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              <CloseIcon size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pošlji e-pošto</DialogTitle>
            <DialogDescription>
              E-pošta bo poslana {selectedCount} izbranim strankam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Zadeva</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Vnesite zadevo..."
              />
            </div>

            <div>
              <Label>Vsebina</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Vnesite vsebino sporočila..."
                rows={6}
              />
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                Prejemniki: {selectedCount} strank
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Prekliči
            </Button>
            <Button onClick={handleBulkEmail}>
              Pošlji {selectedCount} strankam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj oznako</DialogTitle>
            <DialogDescription>
              Oznaka bo dodana {selectedCount} izbranim strankam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ime oznake</Label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="npr. VIP, Redna stranka, Promocija..."
              />
            </div>

            {/* Quick tags */}
            <div>
              <Label>Hitre oznake</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["VIP", "Redna stranka", "Nova stranka", "Promocija", "Aktivna"].map((tag) => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => setTagName(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Prekliči
            </Button>
            <Button onClick={handleBulkTag}>
              Dodaj oznako
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Izbriši stranke</DialogTitle>
            <DialogDescription>
              Ste prepričani, da želite izbrisati {selectedCount} strank?
              Te akcije ni mogoče razveljaviti.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <TrashIcon size={18} className="text-red-500" />
              <p className="font-medium text-red-800">
                Pozor: To je nepovratna akcija!
              </p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              Vsi podatki strank bodo trajno izbrisani, vključno z zgodovino terminov in naročil.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Prekliči
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Da, izbriši {selectedCount} strank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}