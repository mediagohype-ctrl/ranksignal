// Connector registry (brief contract): resolves an Integration row to a live Connector,
// decrypting credentials in memory only. Also exposes the connector catalog (blueprint §3.2).
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { Connector } from "@/lib/types";
import { WordPressConnector } from "@/lib/connectors/wordpress";
import { createManualConnector } from "@/lib/connectors/manual";
import { CONNECTOR_DESCRIPTORS } from "@/lib/connectors/catalog";

export type CatalogStatus = "available" | "planned";
export interface CatalogEntry {
  id: string;
  family: string;
  name: string;
  status: CatalogStatus;
  description: string;
}

export const CONNECTOR_CATALOG: CatalogEntry[] = [
  ...Object.values(CONNECTOR_DESCRIPTORS).map((d) => ({
    id: d.id,
    family: d.family,
    name: d.name,
    status: "available" as const,
    description: d.description,
  })),
  { id: "manual", family: "Export", name: "Manual export", status: "available", description: "Copy-ready instructions for any platform. Nothing is written automatically." },
  { id: "gsc", family: "Analytics", name: "Google Search Console", status: "available", description: "Read-only clicks, impressions and top queries for your site, used in reports and monthly impact reports." },
  { id: "ga4", family: "Analytics", name: "Google Analytics 4", status: "available", description: "Read-only sessions, conversions and AI-referred visits (ChatGPT, Perplexity, Gemini…)." },
];

export interface WordPressCredentials {
  username: string;
  applicationPassword: string;
}

export async function getConnectorForIntegration(integrationId: string, orgId: string): Promise<Connector> {
  const integration = await db.integration.findFirst({ where: { id: integrationId, organizationId: orgId } });
  if (!integration) throw new Error("integration_not_found");
  switch (integration.provider) {
    case "wordpress": {
      if (!integration.credentialEncrypted) throw new Error("integration_disconnected");
      const config = (integration.config as { siteUrl?: string } | null) ?? {};
      if (!config.siteUrl) throw new Error("integration_misconfigured");
      const creds = JSON.parse(decryptSecret(integration.credentialEncrypted)) as WordPressCredentials;
      return new WordPressConnector({ siteUrl: config.siteUrl, username: creds.username, applicationPassword: creds.applicationPassword });
    }
    case "manual":
      return createManualConnector();
    default: {
      const d = CONNECTOR_DESCRIPTORS[integration.provider];
      if (!d) throw new Error(`unsupported_connector:${integration.provider}`);
      if (!integration.credentialEncrypted) throw new Error("integration_disconnected");
      const project = integration.projectId
        ? await db.project.findFirst({ where: { id: integration.projectId, organizationId: orgId }, select: { websiteUrl: true } })
        : null;
      return d.create(integration.config ?? {}, JSON.parse(decryptSecret(integration.credentialEncrypted)), {
        organizationId: orgId,
        integrationId: integration.id,
        projectId: integration.projectId ?? undefined,
        projectWebsiteUrl: project?.websiteUrl,
      });
    }
  }
}
