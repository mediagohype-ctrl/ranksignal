// "Since last month" strip for the project overview: scores, AI rates and issues compared with ~30 days ago.
import type { ReactNode } from "react";
import { History } from "lucide-react";
import type { SnapshotDelta, SnapshotPillar } from "@/lib/snapshots/types";
import { Card, LinkButton } from "@/components/ui";
import { DeltaChip } from "./delta-chip";

const PILLAR_NAMES: Record<SnapshotPillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO", brand: "Brand" };
const pctText = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const dayText = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <li className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-caption text-muted">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-h4 tabular-nums text-fg">{value}</span>
        {children}
      </div>
    </li>
  );
}

export function SinceLastMonth({
  delta,
  baselineIsFirst,
  historyHref,
  preparing = false,
}: {
  delta: SnapshotDelta;
  baselineIsFirst: boolean;
  historyHref: string;
  preparing?: boolean;
}) {
  const title = baselineIsFirst ? "Since your first measurement" : "Since last month";
  const lfl = delta.visibility.likeForLike;
  const hasVis = delta.visibility.mentionRate.after !== null;
  const notes = [...delta.notes];
  if (preparing && !delta.to) notes.push("We're preparing your measurement history from past checks — refresh in a minute.");
  return (
    <Card as="section" aria-label={title} padding="md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h4 text-fg">{title}</h2>
          <p className="text-small text-muted">
            {delta.from && delta.to
              ? `Comparing ${dayText(delta.from.at)} with ${dayText(delta.to.at)}. Measured changes, not proof of cause.`
              : "Changes show up once there are two measurements to compare."}
          </p>
        </div>
        <LinkButton href={historyHref} variant="ghost" size="sm" icon={<History />}>
          Full history
        </LinkButton>
      </div>
      {delta.to && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-label="Changes">
          <Tile label="Overall" value={delta.overall.after ?? "—"}>
            <DeltaChip delta={delta.overall.delta} />
          </Tile>
          {(Object.keys(PILLAR_NAMES) as SnapshotPillar[]).map((p) => (
            <Tile key={p} label={PILLAR_NAMES[p]} value={delta.pillars[p].after ?? "—"}>
              <DeltaChip delta={delta.pillars[p].delta} />
            </Tile>
          ))}
          <Tile label={lfl ? "Mentioned (same questions)" : "Mentioned"} value={hasVis ? pctText(delta.visibility.mentionRate.after) : "—"}>
            {hasVis && <DeltaChip delta={delta.visibility.mentionRate.delta} unit="pp" />}
          </Tile>
          <Tile label={lfl ? "Linked (same questions)" : "Linked to your site"} value={hasVis ? pctText(delta.visibility.citationRate.after) : "—"}>
            {hasVis && <DeltaChip delta={delta.visibility.citationRate.delta} unit="pp" />}
          </Tile>
          <Tile
            label="Issues fixed / new"
            value={
              delta.issues.fixed === null && delta.issues.new === null ? (
                "—"
              ) : (
                <>
                  <span className="text-success">{delta.issues.fixed ?? 0}</span>
                  <span className="text-muted"> / </span>
                  <span className={(delta.issues.new ?? 0) > 0 ? "text-danger" : undefined}>{delta.issues.new ?? 0}</span>
                </>
              )
            }
          >
            {delta.issues.total.after !== null && <span className="text-caption text-muted">{delta.issues.total.after} open</span>}
          </Tile>
        </ul>
      )}
      {notes.length > 0 && (
        <p className="mt-3 text-caption font-normal text-muted">
          {notes.join(" ")}
          {lfl && ` Like-for-like sample: ${lfl.before.sampleSize} → ${lfl.after.sampleSize} answers.`}
        </p>
      )}
    </Card>
  );
}
