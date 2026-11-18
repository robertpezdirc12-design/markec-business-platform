import { Skeleton } from "@/components/ui/skeleton"

// Skeletonski prikaz med nalaganjem strani v območju stranke (trgovina,
// košarica, moj račun …). Glava in noga ostaneta iz layouta; tu se
// nadomesti samo vsebina, zato navigacija ne "poči" v prazno.
export default function CustomerLoading() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Nalaganje …</span>

      <div className="space-y-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card overflow-hidden rounded-xl border">
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
