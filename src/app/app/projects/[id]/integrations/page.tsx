import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asRecord } from "@/lib/dashboard/format";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import { MANUAL_CAPABILITIES } from "@/lib/connectors/manual";
import { CONNECTOR_CATALOG } from "@/lib/connectors/registry";
import type { ConnectorCapabilities } from "@/lib/types";
import { IntegrationsPanel, type IntegrationView } from "@/components/app/integrations-panel";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  // Explicit select: credentialEncrypted is never loaded into the page.
  const rows = await db.integration.findMany({
    where: { organizationId: session.organizationId, OR: [{ projectId: project.id }, { projectId: null }] },
    select: { id: true, provider: true, health: true, config: true, connectedBy: true, lastSyncAt: true, createdAt: true, capabilities: true },
    orderBy: { createdAt: "desc" },
  });
  const integrations: IntegrationView[] = rows.map((r) => {
    const config = asRecord<unknown>(r.config);
    return {
      id: r.id,
      provider: r.provider,
      health: r.health,
      siteUrl: typeof config.siteUrl === "string" ? config.siteUrl : null,
      connectedBy: r.connectedBy,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      capabilities: (r.capabilities as Partial<ConnectorCapabilities> | null) ?? null,
    };
  });
  const capabilityMap: Record<string, ConnectorCapabilities> = {
    wordpress: WORDPRESS_CAPABILITIES,
    manual: MANUAL_CAPABILITIES,
  };
  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Connect your website"
        description="Link your website so the changes you approve can be applied for you, checked afterwards, and undone with one click. No connection? You'll get copy-ready steps instead."
      />
      <IntegrationsPanel
        projectId={project.id}
        defaultSiteUrl={project.websiteUrl}
        integrations={integrations}
        catalog={CONNECTOR_CATALOG}
        capabilityMap={capabilityMap}
        canAdmin={hasRole(session, "admin")}
        canTest={hasRole(session, "member")}
      />
    </>
  );
}
