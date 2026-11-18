import { Skeleton } from "@/components/ui/skeleton"

// Skeletonski prikaz med nalaganjem nadzorne plošče. Ohrani občutek
// hitrosti pri počasnih poizvedbah (dashboard agregira več tabel) in
// prepreči "skok" postavitve, ko se vsebina prikaže.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Nalaganje nadzorne plošče …</span>

      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="bg-card rounded-xl border p-5">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
