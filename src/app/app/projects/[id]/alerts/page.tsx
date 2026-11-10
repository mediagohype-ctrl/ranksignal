// Project alerts: choose what we warn you about (score drops, new urgent problems, site down, AI mentions,
// pages hidden from Google, Google clicks), how (in-app, email, WhatsApp, daily digest) and who; plus the history.
import { BellRing } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getAlertsView } from "@/lib/alerts/server";
import { ALERT_RULES, RULE_META, type AlertRuleId } from "@/lib/alerts/config";
import { fmtDate } from "@/lib/dashboard/format";
import { AlertSettingsForm } from "@/components/app/alerts/alert-settings-form";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, type Tone } from "@/components/ui";

export const metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  warning: { label: "Heads-up", tone: "warning" },
  info: { label: "Good to know", tone: "info" },
};
const CHANNEL_LABEL: Record<string, string> = { in_app: "In app", email: "Email", whatsapp: "WhatsApp" };

export default async function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const canManage = hasRole(session, "admin") && !session.readOnly;
  const view = await getAlertsView(session.organizationId, project.id, { includeMembers: hasRole(session, "admin") });

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description={`We'll tell you when something important changes for ${project.name} — so you hear it from us before a customer notices.`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AlertSettingsForm
          projectId={project.id}
          initial={view.config}
          rules={ALERT_RULES}
          members={view.members}
          limits={view.limits}
          canManage={canManage}
          delivery={view.delivery}
        />

        <Card className="self-start">
          <CardHeader icon={<BellRing />} title="Alert history" description="The last 50 alerts for this website. The same alert isn't repeated within 24 hours." />
          <CardBody>
            {view.history.length === 0 ? (
              <EmptyState
                size="sm"
                title="No alerts yet"
                description="That's good news. Alerts appear here after a website check, AI check or Search Console sync finds something worth knowing."
              />
            ) : (
              <ol className="space-y-3">
                {view.history.map((h) => {
                  const sev = SEVERITY[h.severity] ?? SEVERITY.warning!;
                  const rule = RULE_META[h.rule as AlertRuleId];
                  return (
                    <li key={h.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={sev.tone} size="sm">
                          {sev.label}
                        </Badge>
                        {rule && <span className="text-xs text-muted">{rule.label}</span>}
                        <span className="ml-auto text-xs text-muted">{fmtDate(h.createdAt, true)}</span>
                      </div>
                      <p className="mt-1.5 text-small font-semibold text-fg">
                        {h.link ? (
                          <a href={h.link} className="hover:underline">
                            {h.title}
                          </a>
                        ) : (
                          h.title
                        )}
                      </p>
                      <p className="mt-1 whitespace-pre-line break-words text-small text-fg-soft">{h.body}</p>
                      <p className="mt-1.5 text-xs text-muted">
                        {h.status === "pending_digest"
                          ? "Waiting for today's digest"
                          : h.channels.length
                            ? `Sent: ${h.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(", ")}`
                            : "Recorded here only (no channel was on or reachable)"}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
