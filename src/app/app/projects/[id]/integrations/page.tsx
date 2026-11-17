import { CalendarCheck, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { sessionCanConnect } from "@/lib/dashboard/menu";
import { asRecord } from "@/lib/dashboard/format";
import { canConnectWebsite } from "@/lib/billing/offer";
import { bookCallHref } from "@/lib/brand";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import { MANUAL_CAPABILITIES } from "@/lib/connectors/manual";
import { CONNECTOR_DESCRIPTORS } from "@/lib/connectors/catalog";
import { publicDescriptor } from "@/lib/connectors/catalog/types";
import { getSitePlatform } from "@/lib/platform/server";
import type { ConnectorCapabilities } from "@/lib/types";
import { IntegrationsPanel, type IntegrationView } from "@/components/app/integrations-panel";
import { ConnectGoogle } from "@/components/app/integrations/connect-google";
import { choiceForPlatform, detectedName } from "@/components/app/integrations/platforms";
import { Card, CardBody, LinkButton, Notice, PageHeader, SectionHeading } from "@/components/ui";

export const metadata = { title: "Connect website" };

/** Google Search Console / GA4 are for reports (shown apart, for every offer) — not website connections. */
const REPORT_PROVIDERS = ["gsc", "ga4"];

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const canAdmin = hasRole(session, "admin");
  // Explicit select: credentialEncrypted is never loaded into the page.
  const [org, rows] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true, serviceTier: true } }),
    db.integration.findMany({
      where: { organizationId: session.organizationId, OR: [{ projectId: project.id }, { projectId: null }], provider: { notIn: REPORT_PROVIDERS } },
      select: { id: true, provider: true, health: true, config: true, connectedBy: true, lastSyncAt: true, createdAt: true, capabilities: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Do it myself has no website connections (owner decision 1): the owner makes each change by hand, with
  // ready-to-paste text and steps. Connections made earlier are kept but not shown or used. Google for reports
  // stays available to everyone. MyWebRank staff in support mode see the connection screen.
  if (!sessionCanConnect(org, session)) {
    const callHref = bookCallHref();
    return (
      <div className="space-y-10">
        <PageHeader title="Connect website" description="How changes reach your website on your plan." />
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <Wrench className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-h4 text-fg">On Do it myself you make each change yourself</h2>
              <p className="max-w-2xl text-small text-fg-soft">
                Every fix comes with ready-to-paste text and steps, so there is nothing to connect. Want our team to make the changes for
                you?
              </p>
              <div className="flex flex-wrap gap-2">
                <LinkButton href={callHref} icon={<CalendarCheck />} external={/^https?:\/\//.test(callHref)}>
                  Book a free call
                </LinkButton>
                <LinkButton href={`/app/projects/${project.id}/todo`} variant="secondary">
                  Open my To-do list
                </LinkButton>
              </div>
            </div>
          </CardBody>
        </Card>
        <section aria-labelledby="int-google">
          <SectionHeading
            id="int-google"
            title="Connect Google for reports"
            description="Optional and read-only. Adds real Google clicks, searches and visits to your reports. Nothing on your website changes."
          />
          <ConnectGoogle projectId={project.id} canAdmin={canAdmin} />
        </section>
      </div>
    );
  }

  const integrations: IntegrationView[] = rows.map((r) => {
    const config = asRecord<unknown>(r.config);
    return {
      id: r.id,
      provider: r.provider,
      health: r.health,
      siteUrl:
        typeof config.siteUrl === "string" ? config.siteUrl : typeof config.identity === "string" ? config.identity : null,
      connectedBy: r.connectedBy,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      capabilities: (r.capabilities as Partial<ConnectorCapabilities> | null) ?? null,
    };
  });
  const capabilityMap: Record<string, ConnectorCapabilities> = {
    ...Object.fromEntries(Object.values(CONNECTOR_DESCRIPTORS).map((d) => [d.id, d.capabilities])),
    wordpress: WORDPRESS_CAPABILITIES,
    manual: MANUAL_CAPABILITIES,
  };
  // Descriptors hold functions, so only their public (serializable) part goes to the client component.
  const descriptors = Object.values(CONNECTOR_DESCRIPTORS)
    .filter((d) => d.id !== "wordpress")
    .map((d) => publicDescriptor(d));

  // What the last website check found the site is built with ("We found Shopify. Is that right?"). Never blocks the page.
  let detected: { choiceId: string; name: string } | null = null;
  try {
    const crawl = await db.crawlRun.findFirst({
      where: { organizationId: session.organizationId, projectId: project.id, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const platform = await getSitePlatform(session.organizationId, project.id, project.websiteUrl, crawl?.id ?? null);
    const choice = choiceForPlatform(platform);
    const name = detectedName(platform);
    if (choice && name) detected = { choiceId: choice.id, name };
  } catch {
    detected = null;
  }

  return (
    <>
      <PageHeader
        title="Connect website"
        description="Link your website so the fixes you approve can go live for you, and be undone in one click."
      />
      {!canConnectWebsite(org) && (
        <Notice tone="warning" title="Staff view" className="mb-6">
          This account is on Do it myself: the customer does not see this screen, new connections are refused and nothing is published
          for them.
        </Notice>
      )}
      <IntegrationsPanel
        projectId={project.id}
        defaultSiteUrl={project.websiteUrl}
        integrations={integrations}
        capabilityMap={capabilityMap}
        descriptors={descriptors}
        detected={detected}
        canAdmin={canAdmin}
        canTest={hasRole(session, "member")}
      />
    </>
  );
}
