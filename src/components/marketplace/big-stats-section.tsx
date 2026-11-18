"use client"

// ============================================================
// BIG STATS SECTION (Fresha-inspired, superior 2026-11-16)
// Impressive statistics with animated counters.
// Surpasses Fresha with better visual design and layout.
// ============================================================

import { useState, useEffect, useRef } from "react"
import {
  CalendarIcon,
  UsersIcon,
  
  CheckCircleIcon,
} from "@/components/icons"
import {
  Buildings,
  Globe,
} from "@phosphor-icons/react/dist/ssr"

interface Stat {
  icon: React.ReactNode
  value: number
  suffix: string
  label: string
  description: string
}

function useAnimatedCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const steps = 60
    const increment = target / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, target, duration])

  return { count, ref }
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const { count, ref } = useAnimatedCounter(stat.value, 2000 + index * 300)

  return (
    <div ref={ref} className="text-center">
      {/* Icon */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <div className="text-primary">{stat.icon}</div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <span className="text-4xl font-bold sm:text-5xl lg:text-6xl">
          {count.toLocaleString("sl-SI")}
        </span>
        <span className="text-3xl font-bold text-primary sm:text-4xl lg:text-5xl">
          {stat.suffix}
        </span>
      </div>

      {/* Label */}
      <p className="text-lg font-semibold">{stat.label}</p>

      {/* Description */}
      <p className="mt-1 text-sm text-muted-foreground">
        {stat.description}
      </p>
    </div>
  )
}


interface BigStatsSectionProps {
  totalAppointments?: number
  totalBusinesses?: number
  citiesCount?: number
  totalCustomers?: number
}

export function BigStatsSection({
  totalAppointments = 1000000,
  totalBusinesses = 500,
  citiesCount = 85,
  totalCustomers = 10000,
}: BigStatsSectionProps) {
  const stats: Stat[] = [
    {
      icon: <CalendarIcon size={28} />,
      value: totalAppointments,
      suffix: "+",
      label: "Rezerviranih terminov",
      description: "Vsak mesec se rezervira na tisoče terminov",
    },
    {
      icon: <Buildings size={28} />,
      value: totalBusinesses,
      suffix: "+",
      label: "Partnerskih podjetij",
      description: "Saloni, brivci, wellness centri in zdravniki",
    },
    {
      icon: <Globe size={28} />,
      value: citiesCount,
      suffix: "+",
      label: "Mest po Sloveniji",
      description: "Od Ljubljane do Maribora, Celja, Kopra...",
    },
    {
      icon: <UsersIcon size={28} />,
      value: totalCustomers,
      suffix: "+",
      label: "Zadovoljnih strank",
      description: "Ljudje, ki zaupajo MARKEC vsak dan",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-600 to-accent py-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, white 2px, transparent 2px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Content */}
      <div className="container relative mx-auto px-4">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Najbolje ocenjena destinacija za samoskrbo
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Ena rešitev, ena programska oprema. Zaupajo mu najboljši v panogi
            samoskrbe.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-white">
              <StatCard stat={{ ...stat, icon: <div className="text-white">{stat.icon}</div> }} index={index} />
            </div>
          ))}
        </div>

        {/* Bottom Trust Badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
          {[
            // Audit 2026-11-17: "5/5 na Capterra" in "99.9% uptime" sta bili
            // neverificirani trditvi (platforma ni na Capterru). Zamenjano z
            // dejstvi, ki jih uporabnik lahko preveri sam.
            { icon: <CheckCircleIcon size={20} />, text: "Brez pogodbe in vezave" },
            // Produkcijska baza (Neon) teče v regiji aws-us-east-1 — trditev
          // »podatki v EU« bi bila napačna. Namesto nje preverljivo dejstvo:
          // vsak najemnik lahko svoje podatke izvozi (GDPR izvoz).
          { icon: <CheckCircleIcon size={20} />, text: "Izvoz svojih podatkov kadarkoli" },
            { icon: <UsersIcon size={20} />, text: "24/7 podpora" },
          ].map((badge) => (
            <div
              key={badge.text}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
            >
              <div className="text-white">{badge.icon}</div>
              <span className="text-sm font-medium text-white">{badge.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="currentColor"
            className="text-background"
          />
        </svg>
      </div>
    </section>
  )
}