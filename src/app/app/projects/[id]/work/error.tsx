"use client";
import { RouteError } from "@/components/app/audit/route-states";

export default function WorkError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} what="the work board" />;
}
