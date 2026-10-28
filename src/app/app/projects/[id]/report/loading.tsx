import { SkeletonCard } from "@/components/ui";

export default function ReportLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <SkeletonCard label="Loading your report…" />
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
