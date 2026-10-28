import { Skeleton, SkeletonCard } from "@/components/ui";

export default function OnboardingLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-label="Loading setup">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="mb-6 h-12 w-full" rounded="lg" />
      <SkeletonCard label="Loading setup…" lines={6} />
    </div>
  );
}
