import { Skeleton, SkeletonCard } from "@/components/ui";

export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading settings">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="mb-8 h-10 w-full max-w-md" />
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2" label="Loading workspace details…" lines={5} />
        <SkeletonCard label="Loading…" lines={3} />
      </div>
    </div>
  );
}
