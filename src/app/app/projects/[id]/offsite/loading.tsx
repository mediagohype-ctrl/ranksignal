import { RouteSkeleton } from "@/components/app/audit/route-states";

export default function Loading() {
  return <RouteSkeleton label="Loading off-site work…" stats={4} cards={2} />;
}
