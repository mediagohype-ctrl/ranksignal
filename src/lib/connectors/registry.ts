// Connector registry (brief contract): resolves an Integration row to a live Connector,
// decrypting credentials in memory only. Also exposes the connector catalog (blueprint §3.2).
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { Connector } from "@/lib/types";
import { WordPressConnector } from "@/lib/connectors/wordpress";
import { createManualConnector } from "@/lib/connectors/manual";

export type CatalogStatus = "available" | "planned";
export interface CatalogEntry {
  id: string;
  family: string;
  name: string;
  status: CatalogStatus;
  description: string;
}

export const CONNECTOR_CATALOG: CatalogEntry[] = [
  { id: "wordpress", family: "CMS", name: "WordPress", status: "available", description: "Read pages/posts, update titles, excerpts and (where registered) meta descriptions; create drafts; rollback via before-state." },
  { id: "manual", family: "Export", name: "Manual export", status: "available", description: "Copy-ready instructions for any platform. Nothing is written automatically." },
  { id: "github", family: "Code repository", name: "GitHub (pull requests)", status: "planned", description: "Propose changes to static/Next.js sites as pull requests." },
  { id: "shopify", family: "Commerce", name: "Shopify", status: "planned", description: "Product and collection metadata." },
  { id: "webflow", family: "Website builder", name: "Webflow", status: "planned", description: "CMS collection items and page SEO settings." },
  { id: "contentful", family: "Headless CMS", name: "Contentful", status: "planned", description: "Entries via the Content Management API with drafts." },
  { id: "sanity", family: "Headless CMS", name: "Sanity", status: "planned", description: "Document patches with revision history." },
  { id: "wix", family: "Website builder", name: "Wix", status: "planned", description: "Page SEO settings." },
  { id: "gsc", family: "Analytics", name: "Google Search Console", status: "planned", description: "Read-only search performance for prioritisation." },
  { id: "ga4", family: "Analytics", name: "Google Analytics 4", status: "planned", description: "Read-only traffic signals (high-traffic page detection)." },
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
    default:
      throw new Error(`unsupported_connector:${integration.provider}`);
  }
}
