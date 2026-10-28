import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading the work board…" stats={4} cards={2} />;
}
