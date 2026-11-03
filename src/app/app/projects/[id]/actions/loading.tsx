import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading fixes to approve…" stats={0} cards={3} />;
}
