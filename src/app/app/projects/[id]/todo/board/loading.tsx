import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading your to-do list…" stats={0} cards={3} />;
}
