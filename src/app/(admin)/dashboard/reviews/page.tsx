import { StarIcon } from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { ReviewsManager } from "@/components/dashboard/reviews-manager"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"

// ============================================================
// ADMIN REVIEWS PAGE (Fresha-inspired 2026-11-15)
// Manage customer reviews and feedback.
// ============================================================

export default async function ReviewsPage() {
  await requirePagePermission("customers.manage")
  const [{ t }, org] = await Promise.all([
    getServerI18n(),
    getSessionOrg(),
  ])

  if (!org) {
    return <div>Ni organizacije</div>
  }

  // Fetch reviews from database
  const reviews = await prisma.review.findMany({
    where: { organizationId: org.id },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  // Transform for the component
  const formattedReviews = reviews.map((review) => ({
    id: review.id,
    customerName: review.user?.name || "Anonimno",
    rating: review.rating,
    comment: review.comment,
    date: new Date(review.createdAt).toLocaleDateString("sl-SI"),
    status: "APPROVED" as const,
    response: null,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <StarIcon size={24} className="mr-2 inline text-primary-text" />
          Mnenja strank
        </h1>
        <p className="text-muted-foreground">
          Pregled in moderacija mnenj strank. Odgovarjajte na mnenja za gradnjo zaupanja.
        </p>
      </div>

      <ReviewsManager reviews={formattedReviews} />
    </div>
  )
}