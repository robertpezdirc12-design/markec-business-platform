"use server"

import { prisma } from "@/lib/prisma"
import { DEFAULT_BUSINESS_IMAGE } from "@/lib/default-assets"
import { cache } from "react"

export interface MarketplaceBusiness {
  id: string
  name: string
  type: string
  address: string
  rating: number
  reviews: number
  image: string
  badge?: "Predstavljamo" | "Novo" | "Priljubljeno" | "Ponudbe"
  isOpen: boolean
  openUntil?: string
  priceRange?: string
  slug: string
  category: string
  city: string
  services?: string[]
  phone?: string
  email?: string
}

export interface MarketplaceStats {
  totalBusinesses: number
  totalAppointments: number
  totalCustomers: number
  citiesCount: number
  averageRating: number
}

/**
 * Pridobi podjetja za marketplace (javna tržnica)
 */
export const getMarketplaceBusinesses = cache(
  async (options?: {
    category?: string
    q?: string
    city?: string
    limit?: number
    offset?: number
    sort?: "rating" | "reviews" | "newest" | "name"
    variant?: "recommended" | "popular" | "new"
  }): Promise<MarketplaceBusiness[]> => {
    try {
      const {
        category,
        q,
        city,
        limit = 12,
        offset = 0,
        sort = "rating",
        variant,
      } = options || {}

      // Build where clause - only active, PUBLISHED organizations. An org
      // that never published (or was unpublished) must not leak its contact
      // details into the public marketplace.
      const where: Record<string, unknown> = {
        status: "ACTIVE",
        publishState: "PUBLISHED",
      }

      if (category) {
        where.vertical = category
      }

      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { vertical: { contains: q, mode: "insensitive" } },
          { services: { some: { name: { contains: q, mode: "insensitive" } } } },
          { salonConfig: { is: { city: { contains: q, mode: "insensitive" } } } },
        ]
      }

      if (city) {
        where.salonConfig = {
          is: { city: { contains: city, mode: "insensitive" } },
        }
      }

      // Build orderBy
      let orderBy: Record<string, string> = {}
      switch (sort) {
        case "newest":
          orderBy = { createdAt: "desc" }
          break
        case "name":
          orderBy = { name: "asc" }
          break
        default:
          orderBy = { createdAt: "desc" }
      }

      // Fetch organizations with related data
      const organizations = await prisma.organization.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          salonConfig: {
            select: {
              city: true,
              email: true,
              phone: true,
            },
          },
          services: {
            take: 3,
            select: {
              name: true,
            },
          },
        },
      })

      // Ratings: one GROUP BY instead of loading every active review row
      // for every listed org (previously O(reviews) transferred per page).
      const ratingRows =
        organizations.length > 0
          ? await prisma.review.groupBy({
              by: ["organizationId"],
              where: {
                organizationId: { in: organizations.map((o) => o.id) },
                isActive: true,
              },
              _avg: { rating: true },
              _count: { _all: true },
            })
          : []
      const ratings = new Map(
        ratingRows.map((r) => [
          r.organizationId,
          { avg: r._avg.rating ?? 0, count: r._count._all },
        ])
      )

      // Transform to MarketplaceBusiness
      return organizations.map((org) => {
        const rating = ratings.get(org.id)
        const avgRating = rating?.avg ?? 0

        return {
          id: org.id,
          name: org.name,
          type: org.vertical || "Storitev",
          address: org.salonConfig?.city || "Slovenija",
          rating: Math.round(avgRating * 10) / 10,
          reviews: rating?.count ?? 0,
          image: org.logo || DEFAULT_BUSINESS_IMAGE,
          badge: variant === "new" ? ("Novo" as const) : undefined,
          isOpen: true,
          openUntil: "20:00",
          priceRange: "€€",
          slug: org.slug,
          category: org.vertical || "splošno",
          city: org.salonConfig?.city || "Slovenija",
          services: org.services.map((s) => s.name),
          phone: org.salonConfig?.phone || undefined,
          email: org.salonConfig?.email || undefined,
        }
      })
    } catch (error) {
      console.error("Error fetching marketplace businesses:", error)
      return []
    }
  }
)

/**
 * Pridobi statistike za marketplace
 */
export const getMarketplaceStats = cache(
  async (): Promise<MarketplaceStats> => {
    try {
      const publishedOrg = { status: "ACTIVE", publishState: "PUBLISHED" } as const
      const [totalBusinesses, totalAppointments, totalCustomers] =
        await Promise.all([
          prisma.organization.count({
            where: publishedOrg,
          }),
          prisma.appointment.count({
            where: { organization: publishedOrg },
          }),
          prisma.customer.count({
            where: { organization: publishedOrg },
          }),
        ])

      // Get unique cities
      const cities = await prisma.salonConfig.findMany({
        where: {
          city: { not: null },
          organization: publishedOrg,
        },
        select: {
          city: true,
        },
        distinct: ["city"],
      })

      // Calculate average rating
      const reviews = await prisma.review.aggregate({
        where: { isActive: true, organization: publishedOrg },
        _avg: {
          rating: true,
        },
      })

      return {
        totalBusinesses,
        totalAppointments,
        totalCustomers,
        citiesCount: cities.length,
        averageRating: Math.round((reviews._avg.rating || 0) * 10) / 10,
      }
    } catch (error) {
      console.error("Error fetching marketplace stats:", error)
      return {
        totalBusinesses: 0,
        totalAppointments: 0,
        totalCustomers: 0,
        citiesCount: 0,
        averageRating: 0,
      }
    }
  }
)

/**
 * Pridobi priporočena podjetja
 */
export const getRecommendedBusinesses = cache(
  async (): Promise<MarketplaceBusiness[]> => {
    return getMarketplaceBusinesses({
      variant: "recommended",
      sort: "rating",
      limit: 6,
    })
  }
)

/**
 * Pridobi priljubljena podjetja
 */
export const getPopularBusinesses = cache(
  async (): Promise<MarketplaceBusiness[]> => {
    return getMarketplaceBusinesses({
      variant: "popular",
      sort: "reviews",
      limit: 6,
    })
  }
)

/**
 * Pridobi nova podjetja
 */
export const getNewBusinesses = cache(
  async (): Promise<MarketplaceBusiness[]> => {
    return getMarketplaceBusinesses({
      variant: "new",
      sort: "newest",
      limit: 6,
    })
  }
)

/**
 * Poišči podjetja
 */
export const searchBusinesses = cache(
  async (query: string): Promise<MarketplaceBusiness[]> => {
    try {
      const organizations = await prisma.organization.findMany({
        where: {
          AND: [
            { status: "ACTIVE" },
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { slug: { contains: query, mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 20,
        include: {
          salonConfig: {
            select: {
              city: true,
              email: true,
              phone: true,
            },
          },
          services: {
            take: 3,
            select: {
              name: true,
            },
          },
          reviews: {
            where: { isActive: true },
            select: {
              rating: true,
            },
          },
          _count: {
            select: {
              reviews: {
                where: { isActive: true },
              },
            },
          },
        },
      })

      return organizations.map((org) => {
        const avgRating =
          org.reviews.length > 0
            ? org.reviews.reduce((sum, r) => sum + r.rating, 0) /
              org.reviews.length
            : 0

        return {
          id: org.id,
          name: org.name,
          type: org.vertical || "Storitev",
          address: org.salonConfig?.city || "Slovenija",
          rating: Math.round(avgRating * 10) / 10,
          reviews: org._count.reviews,
          image: org.logo || DEFAULT_BUSINESS_IMAGE,
          isOpen: true,
          slug: org.slug,
          category: org.vertical || "splošno",
          city: org.salonConfig?.city || "Slovenija",
          services: org.services.map((s) => s.name),
        }
      })
    } catch (error) {
      console.error("Error searching businesses:", error)
      return []
    }
  }
)