"use client"

// ============================================================
// REVIEWS MANAGER (Fresha-inspired 2026-11-15)
// Manage customer reviews and feedback.
// Like Fresha's "Reviews" — moderate and respond to reviews.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  FilterIcon,
  EyeIcon,
} from "@/components/icons"
import { Chat as ChatIcon } from "@phosphor-icons/react/dist/ssr"

interface Review {
  id: string
  customerName: string
  customerAvatar?: string | null
  rating: number
  comment: string
  serviceName?: string
  date: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  response?: string | null
}

interface ReviewsManagerProps {
  reviews: Review[]
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          size={size}
          className={star <= rating ? "text-amber-400" : "text-gray-200"}
          weight={star <= rating ? "fill" : "regular"}
        />
      ))}
    </div>
  )
}

const statusConfig = {
  PENDING: { label: "V pregledu", color: "bg-amber-500 text-white" },
  APPROVED: { label: "Odobreno", color: "bg-green-500 text-white" },
  REJECTED: { label: "Zavrnjeno", color: "bg-red-500 text-white" },
}

export function ReviewsManager({ reviews }: ReviewsManagerProps) {
  const [items, setItems] = useState<Review[]>(reviews)
  const [filter, setFilter] = useState("all")
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [responseText, setResponseText] = useState("")

  const filteredReviews = items.filter((review) => {
    if (filter === "all") return true
    return review.status === filter
  })

  const handleApprove = (id: string) => {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" as const } : r))
    )
    toast.success("Mnenje odobreno")
  }

  const handleReject = (id: string) => {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "REJECTED" as const } : r))
    )
    toast.success("Mnenje zavrnjeno")
  }

  const handleRespond = () => {
    if (!selectedReview || !responseText.trim()) return
    
    setItems((prev) =>
      prev.map((r) =>
        r.id === selectedReview.id ? { ...r, response: responseText } : r
      )
    )
    setSelectedReview(null)
    setResponseText("")
    toast.success("Odgovor objavljen")
  }

  // Calculate stats
  const averageRating = items.length > 0
    ? items.reduce((sum, r) => sum + r.rating, 0) / items.length
    : 0
  const pendingCount = items.filter((r) => r.status === "PENDING").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upravljanje mnenj</h2>
          <p className="text-muted-foreground">
            Pregled in moderacija mnenj strank.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <StarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Povprečna ocena</p>
                <p className="text-2xl font-bold">{averageRating.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <ChatIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skupaj mnenj</p>
                <p className="text-2xl font-bold">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <FilterIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Čaka na pregled</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsa mnenja</SelectItem>
            <SelectItem value="PENDING">V pregledu</SelectItem>
            <SelectItem value="APPROVED">Odobrena</SelectItem>
            <SelectItem value="REJECTED">Zavrnjena</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{filteredReviews.length} mnenj</Badge>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
                    {review.customerName[0]}
                  </div>

                  <div>
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{review.customerName}</p>
                      <Badge className={statusConfig[review.status].color}>
                        {statusConfig[review.status].label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <StarRating rating={review.rating} />
                      <span className="text-sm text-muted-foreground">
                        {review.date}
                      </span>
                      {review.serviceName && (
                        <Badge variant="outline">{review.serviceName}</Badge>
                      )}
                    </div>

                    {/* Comment */}
                    <p className="mt-3 text-sm">{review.comment}</p>

                    {/* Response */}
                    {review.response && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">
                          Naš odgovor:
                        </p>
                        <p className="mt-1 text-sm">{review.response}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {review.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(review.id)}
                      >
                        <CheckCircleIcon size={14} className="mr-1" />
                        Odobri
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(review.id)}
                      >
                        <XCircleIcon size={14} className="mr-1" />
                        Zavrni
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedReview(review)
                      setResponseText(review.response || "")
                    }}
                  >
                    <ChatIcon size={14} className="mr-1" />
                    Odgovori
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Response Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odgovori na mnenje</DialogTitle>
            <DialogDescription>
              {selectedReview?.customerName} — {selectedReview?.rating} zvezdic
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Original review */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm">{selectedReview?.comment}</p>
            </div>

            {/* Response */}
            <div>
              <label className="text-sm font-medium">Vaš odgovor</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Hvala za vaše mnenje..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReview(null)}>
              Prekliči
            </Button>
            <Button onClick={handleRespond}>Objavi odgovor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
