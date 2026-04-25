import { Skeleton } from "@/components/ui/skeleton";

/* -------------------------------------------------------------------------- */
/*  Page skeletons — shown while data loads. Bottom nav stays mounted because  */
/*  these render *inside* MobileLayout's <main> slot.                          */
/* -------------------------------------------------------------------------- */

export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 pb-28 animate-in fade-in duration-200">
      {/* Hero */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-primary/30 to-secondary/30 space-y-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-32 bg-white/30" />
          <Skeleton className="h-7 w-20 rounded-full bg-white/30" />
        </div>
        <Skeleton className="h-7 w-48 bg-white/40" />
        <Skeleton className="h-5 w-40 bg-white/30" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 flex-1 rounded-xl bg-white/40" />
          <Skeleton className="h-10 flex-1 rounded-xl bg-white/30" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* List section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-xl" />
              <Skeleton className="h-10 flex-1 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-7 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ServicesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-9 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="px-4 pt-5 pb-28 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="rounded-3xl p-6 bg-gradient-to-br from-primary/30 to-secondary/30 space-y-3">
        <Skeleton className="h-7 w-40 bg-white/40" />
        <Skeleton className="h-4 w-56 bg-white/30" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      {/* Big card (chart placeholder) */}
      <div className="rounded-2xl border border-border/50 p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>

      {/* Photos row */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="px-4 pb-24 space-y-4 animate-in fade-in duration-200">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function CustomerDetailSkeleton() {
  return (
    <div className="p-4 space-y-5 animate-in fade-in duration-200 pb-28">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="rounded-2xl border border-border/50 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
