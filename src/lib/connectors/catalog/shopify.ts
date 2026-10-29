// Shopify connector descriptor (ROUND 5 connector plugin contract).
import { z } from "zod";
import {
  ShopifyConnector, SHOPIFY_CAPABILITIES, normalizeShopDomain,
  type ShopifyConfig, type ShopifySecrets,
} from "@/lib/connectors/shopify";
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";

const inputSchema = z.object({
  shopDomain: z.string().trim().min(1).max(200),
  siteUrl: z.string().trim().max(500).optional(),
  accessToken: z.string().trim().min(10).max(500),
});

function checkSiteUrl(raw: string | undefined, fallback: string | undefined, shop: string): string {
  const candidate = raw || fallback || `https://${shop}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new ConnectorConfigError("Store URL must be a full https:// address, e.g. https://www.example.com", "siteUrl");
  }
  if (u.protocol !== "https:") throw new ConnectorConfigError("Store URL must use https://", "siteUrl");
  return u.origin;
}

export const descriptor: ConnectorDescriptor<ShopifyConfig, ShopifySecrets> = {
  id: "shopify",
  family: "Commerce",
  name: "Shopify",
  status: "available",
  description:
    "Update SEO titles, meta descriptions, descriptions and product image alt text on products, collections, pages and blog articles. Never touches prices, inventory, checkout or publishing; every change records a before-state for rollback.",
  capabilities: SHOPIFY_CAPABILITIES,
  connectFields: [
    {
      key: "shopDomain",
      label: "Shopify admin domain",
      type: "text",
      placeholder: "your-store.myshopify.com",
      help: "Your permanent .myshopify.com address (Shopify admin → Settings → Domains). Not your custom domain.",
    },
    {
      key: "siteUrl",
      label: "Store URL",
      type: "url",
      required: false,
      placeholder: "https://www.example.com",
      help: "The public address customers visit. Used to match pages we audit to Shopify products and pages. Defaults to the project's website.",
    },
    {
      key: "accessToken",
      label: "Admin API access token",
      type: "password",
      placeholder: "shpat_…",
      help: "Shown once when you install the custom app. Stored encrypted; we never display it again.",
    },
  ],
  setupSteps: [
    "In Shopify admin open Settings → Apps and sales channels → Develop apps. If asked, click \"Allow custom app development\" (store owner only).",
    "Click \"Create an app\" and name it (for example \"SEO assistant\").",
    "Open Configuration → Admin API integration → Configure, and tick exactly these scopes: read_products, write_products, read_content, write_content, read_online_store_pages, write_online_store_pages. Do not grant orders, customers, inventory, checkout or payment scopes — they are not needed.",
    "Save, then open API credentials and click \"Install app\".",
    "Click \"Reveal token once\" under Admin API access token and copy it (it starts with shpat_).",
    "Paste the token here together with your .myshopify.com domain, then click Connect. We run a read-only check of your shop name first.",
    "To disconnect later, uninstall the custom app in Shopify — that revokes the token immediately.",
  ],
  create(config, secrets, context) {
    const shop = normalizeShopDomain(String(config?.shopDomain ?? ""));
    if (!shop) throw new ConnectorConfigError("Stored Shopify domain is invalid", "shopDomain");
    const siteUrl = checkSiteUrl(config.siteUrl, context?.projectWebsiteUrl, shop);
    return new ShopifyConnector({ shopDomain: shop, siteUrl }, { accessToken: String(secrets?.accessToken ?? "") });
  },
  validateConfig(input, context) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      throw new ConnectorConfigError(
        field === "accessToken" ? "Paste the Admin API access token (starts with shpat_)." : "Check the Shopify connection details.",
        field || undefined,
      );
    }
    const shop = normalizeShopDomain(parsed.data.shopDomain);
    if (!shop) throw new ConnectorConfigError('Enter your admin domain in the form "your-store.myshopify.com".', "shopDomain");
    const siteUrl = checkSiteUrl(parsed.data.siteUrl, context?.projectWebsiteUrl, shop);
    return { config: { shopDomain: shop, siteUrl }, secrets: { accessToken: parsed.data.accessToken } };
  },
};
