// Core Web Vitals card: real page speed from Google PageSpeed Insights (src/lib/pagespeed). Server component.
import { Gauge } from "lucide-react";
import type { CoreWebVitalsSummary, PageVitals, VitalRating, VitalValue } from "@/lib/pagespeed/types";
import { RATING_LABEL, VITAL_LABELS, formatVital, type VitalMetric } from "@/lib/pagespeed/vitals";
import { fmtDate } from "@/lib/dashboard/format";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";

const TONE: Record<VitalRating, "success" | "warning" | "danger"> = { good: "success", needs_improvement: "warning", poor: "danger" };

function path(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "Home page" : u.pathname;
  } catch {
    return url;
  }
}

function Cell({ metric, v }: { metric: VitalMetric; v: VitalValue | null }) {
  if (!v) return <td className="px-2 py-2 text-muted">—</td>;
  return (
    <td className="px-2 py-2">
      <span className="tabular-nums text-fg">{formatVital(metric, v.value)}</span>{" "}
      <Badge tone={TONE[v.rating]} size="sm">
        {RATING_LABEL[v.rating]}
      </Badge>
    </td>
  );
}

function Row({ p }: { p: PageVitals }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-2 py-2">
        <span className="block max-w-[16rem] truncate font-medium text-fg" title={p.url}>
          {path(p.url)}
        </span>
        <span className="text-xs text-muted">
          {p.strategy === "mobile" ? "Phone" : "Computer"} · {p.source === "field" ? "real visitors" : "lab test"}
        </span>
      </td>
      <Cell metric="lcp" v={p.lcp} />
      {p.source === "field" ? <Cell metric="inp" v={p.inp} /> : <Cell metric="tbt" v={p.tbt} />}
      <Cell metric="cls" v={p.cls} />
      <td className="px-2 py-2 tabular-nums text-fg-soft">{p.performanceScore ?? "—"}</td>
    </tr>
  );
}

export function CoreWebVitalsCard({ vitals }: { vitals: CoreWebVitalsSummary | undefined | null }) {
  if (!vitals || vitals.status === "unavailable") return null;
  return (
    <Card as="section" aria-labelledby="cwv" className="break-inside-avoid">
      <CardHeader
        title={
          <span id="cwv" className="inline-flex items-center gap-2">
            <Gauge aria-hidden size={18} /> Page speed (Core Web Vitals)
          </span>
        }
        description={
          vitals.status === "pending"
            ? "Google is testing your pages' speed. This card fills in a few minutes after your website check."
            : `${vitals.passing} of ${vitals.tested} pages pass on phones. Tested by Google PageSpeed Insights${vitals.testedAt ? ` on ${fmtDate(vitals.testedAt)}` : ""}.`
        }
      />
      {vitals.status === "measured" && (
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-small">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Page</th>
                  <th className="px-2 py-1.5 font-medium" title={VITAL_LABELS.lcp.plain}>
                    Main content shows (LCP)
                  </th>
                  <th className="px-2 py-1.5 font-medium" title={VITAL_LABELS.inp.plain}>
                    Reacts to taps (INP / TBT)
                  </th>
                  <th className="px-2 py-1.5 font-medium" title={VITAL_LABELS.cls.plain}>
                    Stays still (CLS)
                  </th>
                  <th className="px-2 py-1.5 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {vitals.pages.map((p) => (
                  <Row key={`${p.url}-${p.strategy}`} p={p} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            &ldquo;Real visitors&rdquo; uses Chrome users&apos; data from the last 28 days. Pages without enough visitors get Google&apos;s lab
            test instead, which measures blocking time (TBT) in place of tap response (INP).
            {vitals.failed > 0 && ` Google couldn't test ${vitals.failed} ${vitals.failed === 1 ? "page" : "pages"} this time.`}
          </p>
        </CardBody>
      )}
    </Card>
  );
}
