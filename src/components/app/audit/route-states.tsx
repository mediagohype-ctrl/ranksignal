"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button, EmptyState, Skeleton, SkeletonCard } from "@/components/ui";

/** Shared error boundary body for the audit / actions / integrations routes. */
export function RouteError({ error, reset, what }: { error: Error & { digest?: string }; reset: () => void; what: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      bordered
      size="lg"
      icon={<AlertTriangle />}
      title={`We couldn't load ${what}`}
      description="This is usually temporary. Try again — if it keeps happening, refresh the page or contact support."
      action={
        <Button icon={<RotateCw />} onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}

/** Page skeleton: header, optional stat row, then card placeholders. */
export function RouteSkeleton({ label, stats = 0, cards = 3 }: { label: string; stats?: number; cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      {stats > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-28" rounded="lg" />
          ))}
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} label={label} lines={3} />
        ))}
      </div>
    </div>
  );
}
