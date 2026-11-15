// ============================================================
// EMPTY STATE (Fresha-inspired 2026-11-15)
// Reusable empty state component with illustration and CTA.
// Used across dashboard for consistent empty states.
// ============================================================

import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    href: string
  }
  size?: "sm" | "md" | "lg"
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-8",
    md: "py-12",
    lg: "py-16",
  }

  const iconSizes = {
    sm: 32,
    md: 48,
    lg: 64,
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses[size]}`}>
      {/* Icon with decorative background */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-muted/50 blur-xl" />
        <div className="relative text-muted-foreground/50">
          {icon}
        </div>
      </div>

      {/* Text */}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {action && (
          action.href ? (
            <Link href={action.href}>
              <Button>{action.label}</Button>
            </Link>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )
        )}
        {secondaryAction && (
          <Link href={secondaryAction.href}>
            <Button variant="outline">{secondaryAction.label}</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

// ============================================================
// PREDEFINED EMPTY STATES
// Common patterns used across the app
// ============================================================

interface NoResultsProps {
  searchQuery?: string
  onClear?: () => void
}

export function NoResults({ searchQuery, onClear }: NoResultsProps) {
  return (
    <EmptyState
      icon={
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M8 11h6" />
        </svg>
      }
      title="Ni rezultatov"
      description={
        searchQuery
          ? `Ni zadetkov za "${searchQuery}". Poskusite z drugim iskanjem.`
          : "Ni zadetkov. Spremenite filtre ali poskusite znova."
      }
      action={
        onClear
          ? { label: "Počisti filtre", onClick: onClear }
          : undefined
      }
      size="sm"
    />
  )
}

interface NoDataProps {
  title: string
  description: string
  icon: ReactNode
  actionLabel: string
  actionHref: string
}

export function NoData({ title, description, icon, actionLabel, actionHref }: NoDataProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={{ label: actionLabel, href: actionHref }}
    />
  )
}
