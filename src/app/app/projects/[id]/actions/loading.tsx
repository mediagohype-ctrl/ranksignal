import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading your actions…" stats={0} cards={3} />;
}
