"use client"

// ============================================================
// LOYALTY PROGRAM (Fresha-inspired 2026-11-15)
// Points-based loyalty program for customers.
// Like Fresha's "Loyalty" — reward repeat customers.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  
  
  
  
  
} from "@/components/ui/select"
import {
  
  
  
  
  
  
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  StarIcon,
  TrendingUpIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
} from "@/components/icons"
import { Gift as GiftIcon } from "@phosphor-icons/react/dist/ssr"

interface LoyaltyTier {
  id: string
  name: string
  minPoints: number
  discount: number // percentage
  benefits: string[]
  color: string
  memberCount: number
}

interface LoyaltyProgramProps {
  tiers?: LoyaltyTier[]
  totalPointsIssued?: number
  totalRewardsRedeemed?: number
}

const defaultTiers: LoyaltyTier[] = [
  {
    id: "bronze",
    name: "Bronasti",
    minPoints: 0,
    discount: 5,
    benefits: ["5% popust na storitve", "Rojstnodnevna ugodnost"],
    color: "bg-amber-600",
    memberCount: 45,
  },
  {
    id: "silver",
    name: "Srebrni",
    minPoints: 500,
    discount: 10,
    benefits: ["10% popust na storitve", "Prednostne rezervacije", "Brezplačna nega ob 10. obisku"],
    color: "bg-gray-400",
    memberCount: 23,
  },
  {
    id: "gold",
    name: "Zlati",
    minPoints: 1500,
    discount: 15,
    benefits: ["15% popust na storitve", "Ekskluzivne ponudbe", "Brezplačne storitve", "Osebni svetovalec"],
    color: "bg-amber-400",
    memberCount: 12,
  },
  {
    id: "platinum",
    name: "Platinasti",
    minPoints: 5000,
    discount: 20,
    benefits: ["20% popust na vse", "VIP dogodki", "Brezplačne storitve", "Prioriteta rezervacij", "Darilni boni"],
    color: "bg-purple-500",
    memberCount: 5,
  },
]

function TierCard({ tier }: { tier: LoyaltyTier }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${tier.color} flex h-12 w-12 items-center justify-center rounded-full text-white`}>
              <StarIcon size={24} />
            </div>
            <div>
              <h3 className="font-semibold">{tier.name}</h3>
              <p className="text-sm text-muted-foreground">
                {tier.minPoints}+ točk
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-lg">
            -{tier.discount}%
          </Badge>
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Ugodnosti:</p>
          <ul className="mt-2 space-y-1">
            {tier.benefits.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Članov:</span>
            <span className="font-semibold">{tier.memberCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LoyaltyProgram({
  tiers = defaultTiers,
  totalPointsIssued = 12500,
  totalRewardsRedeemed = 89,
}: LoyaltyProgramProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Program zvestobe</h2>
          <p className="text-muted-foreground">
            Nagradite zveste stranke s točkami in ugodnostmi.
          </p>
        </div>
        <Button>
          <GiftIcon size={16} className="mr-2" />
          Nastavitve
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <StarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Izdanih točk</p>
                <p className="text-2xl font-bold">{totalPointsIssued.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500 p-3 text-white">
                <GiftIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unovčenih nagrad</p>
                <p className="text-2xl font-bold">{totalRewardsRedeemed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-500 p-3 text-white">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktivnih članov</p>
                <p className="text-2xl font-bold">
                  {tiers.reduce((sum, t) => sum + t.memberCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon size={20} />
            Kako deluje program zvestobe?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <CurrencyDollarIcon size={24} />
              </div>
              <p className="mt-3 font-medium">1. Zbirajte točke</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Za vsak porabljen evro prejmete 1 točko.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <StarIcon size={24} />
              </div>
              <p className="mt-3 font-medium">2. Napredujte</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Z več točkami napredujete v višji nivo (Bronasti → Platinasti).
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <GiftIcon size={24} />
              </div>
              <p className="mt-3 font-medium">3. Unovčite</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Unovčite točke za popuste in brezplačne storitve.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tiers */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Nivoji zvestobe</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>
      </div>

      {/* Points rules */}
      <Card>
        <CardHeader>
          <CardTitle>Pravila zbiranja točk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <CurrencyDollarIcon size={20} className="text-green-500" />
                <div>
                  <p className="font-medium">Nakup storitve</p>
                  <p className="text-sm text-muted-foreground">
                    Za vsak porabljen evro
                  </p>
                </div>
              </div>
              <Badge variant="outline">+1 točka / €</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <ShoppingBagIcon size={20} className="text-blue-500" />
                <div>
                  <p className="font-medium">Nakup izdelka</p>
                  <p className="text-sm text-muted-foreground">
                    Za vsak porabljen evro
                  </p>
                </div>
              </div>
              <Badge variant="outline">+1 točka / €</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <StarIcon size={20} className="text-amber-500" />
                <div>
                  <p className="font-medium">Prvi obisk</p>
                  <p className="text-sm text-muted-foreground">
                    Bonus za nove stranke
                  </p>
                </div>
              </div>
              <Badge variant="outline">+50 točk</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <GiftIcon size={20} className="text-purple-500" />
                <div>
                  <p className="font-medium">Priporočilo prijatelja</p>
                  <p className="text-sm text-muted-foreground">
                    Ko priporočena stranka opravi prvi obisk
                  </p>
                </div>
              </div>
              <Badge variant="outline">+100 točk</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
