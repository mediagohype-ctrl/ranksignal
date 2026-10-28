import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading the audit…" stats={6} cards={3} />;
}
