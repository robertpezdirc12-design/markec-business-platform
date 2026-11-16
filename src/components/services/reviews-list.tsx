// ============================================================
// REVIEWS & TESTIMONIALS (Fresha-inspired 2026-11-15)
// Display customer reviews with ratings and photos.
// Like Fresha's review system — social proof for bookings.
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StarIcon, CheckCircleIcon } from "@/components/icons"

interface Review {
  id: string
  customerName: string
  rating: number // 1-5
  comment: string
  date: string
  serviceName?: string
  verified?: boolean
}

interface ReviewsProps {
  reviews: Review[]
  averageRating?: number
  totalReviews?: number
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
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

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold">
            {review.customerName[0]}
          </div>

          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{review.customerName}</p>
                  {review.verified && (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircleIcon size={10} className="mr-1" />
                      Preverjeno
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{review.date}</p>
              </div>
              <StarRating rating={review.rating} />
            </div>

            {/* Service */}
            {review.serviceName && (
              <Badge variant="secondary" className="mt-2">
                {review.serviceName}
              </Badge>
            )}

            {/* Comment */}
            <div className="mt-3">
              <p className="text-sm">&ldquo;{review.comment}&rdquo;</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReviewsList({
  reviews,
  averageRating = 0,
  totalReviews = 0,
}: ReviewsProps) {
  // Calculate rating distribution
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => Math.round(r.rating) === rating).length,
    percentage:
      reviews.length > 0
        ? Math.round(
            (reviews.filter((r) => Math.round(r.rating) === rating).length /
              reviews.length) *
              100
          )
        : 0,
  }))

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-8">
            {/* Average */}
            <div className="text-center">
              <p className="text-5xl font-bold">{averageRating.toFixed(1)}</p>
              <div className="mt-2">
                <StarRating rating={Math.round(averageRating)} size={20} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {totalReviews} mnenj
              </p>
            </div>

            {/* Distribution */}
            <div className="flex-1 space-y-2">
              {distribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{rating}</span>
                    <StarIcon size={12} className="text-amber-400" weight="fill" />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm text-muted-foreground">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <StarIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Še ni mnenj. Bodite prvi in delite svojo izkušnjo!
              </p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// COMPACT REVIEWS (for homepage/sidebar)
// ============================================================

export function CompactReviews({ reviews }: { reviews: Review[] }) {
  return (
    <div className="space-y-3">
      {reviews.slice(0, 3).map((review) => (
        <div key={review.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{review.customerName}</p>
            <StarRating rating={review.rating} size={12} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {review.comment}
          </p>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// REVIEW STATS BADGE
// ============================================================

export function ReviewStatsBadge({
  rating,
  count,
}: {
  rating: number
  count: number
}) {
  return (
    <Badge variant="outline" className="gap-1">
      <StarIcon size={12} className="text-amber-400" weight="fill" />
      {rating.toFixed(1)} ({count})
    </Badge>
  )
}
