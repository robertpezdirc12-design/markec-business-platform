"use client"

// ============================================================
// REVIEWS MANAGER — moderation writes to the database.
// There is no local-only "approve" and no fake response box: the
// Review model has `isActive` for moderation and no response field,
// so the UI exposes exactly those two real states.
// ============================================================

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  FilterIcon,
} from "@/components/icons"
import { setReviewVisibility } from "@/app/actions/reviews"

interface Review {
  id: string
  customerName: string
  rating: number
  comment: string
  serviceName?: string
  date: string
  status: "APPROVED" | "REJECTED"
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
  APPROVED: { label: "Objavljeno", color: "bg-green-500 text-white" },
  REJECTED: { label: "Skrito", color: "bg-red-500 text-white" },
}

export function ReviewsManager({ reviews }: { reviews: Review[] }) {
  const [items, setItems] = useState<Review[]>(reviews)
  const [filter, setFilter] = useState("all")
  const [pendingId, setPendingId] = useState<string | null>(null)

  const filteredReviews = items.filter((review) => {
    if (filter === "all") return true
    return review.status === filter
  })

  async function handleVisibility(review: Review) {
    const nextStatus = review.status === "APPROVED" ? "REJECTED" : "APPROVED"
    setPendingId(review.id)
    const result = await setReviewVisibility(review.id, nextStatus === "APPROVED")
    setPendingId(null)

    if (!result.success) {
      toast.error(result.error ?? "Sprememba ni uspela")
      return
    }

    setItems((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, status: nextStatus } : r))
    )
    toast.success(nextStatus === "APPROVED" ? "Mnenje je objavljeno" : "Mnenje je skrito")
  }

  const averageRating =
    items.length > 0
      ? items.reduce((sum, r) => sum + r.rating, 0) / items.length
      : 0
  const hiddenCount = items.filter((r) => r.status === "REJECTED").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upravljanje mnenj</h2>
          <p className="text-muted-foreground">
            Objavljajte in skrivajte mnenja. Sprememba se takoj shrani v bazo.
          </p>
        </div>
      </div>

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
            <div>
              <p className="text-sm text-muted-foreground">Skupaj mnenj</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-500 p-3 text-white">
                <FilterIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skritih mnenj</p>
                <p className="text-2xl font-bold">{hiddenCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsa mnenja</SelectItem>
            <SelectItem value="APPROVED">Objavljena</SelectItem>
            <SelectItem value="REJECTED">Skrita</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{filteredReviews.length} mnenj</Badge>
      </div>

      <div className="space-y-4">
        {filteredReviews.length === 0 && (
          <p className="text-muted-foreground py-8 text-sm">
            Ni mnenj za prikaz. Mnenja se pojavijo po opravljenih terminih.
          </p>
        )}
        {filteredReviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
                    {review.customerName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{review.customerName}</p>
                      <Badge className={statusConfig[review.status].color}>
                        {statusConfig[review.status].label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <StarRating rating={review.rating} />
                      <span className="text-sm text-muted-foreground">{review.date}</span>
                      {review.serviceName && (
                        <Badge variant="outline">{review.serviceName}</Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm">{review.comment}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={review.status === "APPROVED" ? "outline" : "default"}
                  disabled={pendingId === review.id}
                  onClick={() => handleVisibility(review)}
                >
                  {review.status === "APPROVED" ? (
                    <>
                      <XCircleIcon size={14} className="mr-1" />
                      Skrij
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon size={14} className="mr-1" />
                      Objavi
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
