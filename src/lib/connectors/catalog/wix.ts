// Wix connector descriptor (ROUND 5 connector plugin contract).
import { z } from "zod";
import { WIX_CAPABILITIES, WixConnector, type WixConfig, type WixSecrets } from "@/lib/connectors/wix";
import { checkSiteUrl } from "@/lib/connectors/catalog/contentful";
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";

const inputSchema = z.object({
  siteId: z.string().trim().regex(/^[0-9a-f-]{20,64}$/i),
  blogPrefix: z.string().trim().regex(/^\/?[A-Za-z0-9_-]+\/?$/).optional().or(z.literal("")),
  apiKey: z.string().trim().min(20).max(2000),
});

function buildConfig(input: Record<string, unknown>, fallbackSite?: string): WixConfig {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const msg: Record<string, string> = {
      siteId: "Enter the Site ID — the long code after /dashboard/ in your Wix dashboard address.",
      blogPrefix: "Blog URL prefix should look like /post/.",
      apiKey: "Paste the full API key.",
    };
    throw new ConnectorConfigError(msg[field] ?? "Check the Wix connection details.", field || undefined);
  }
  const prefix = parsed.data.blogPrefix ? `/${parsed.data.blogPrefix.replace(/^\/+|\/+$/g, "")}/` : "/post/";
  return { siteId: parsed.data.siteId.toLowerCase(), siteUrl: checkSiteUrl(input.siteUrl, fallbackSite), blogPrefix: prefix };
}

export const descriptor: ConnectorDescriptor<WixConfig, WixSecrets> = {
  id: "wix",
  family: "Website builder",
  name: "Wix",
  status: "available",
  description:
    "Update the SEO title, meta description and excerpt of Wix Blog posts as unpublished edits you publish from your dashboard. Pages built in the Wix editor cannot be edited through Wix's API, so for those you get copy-ready instructions.",
  capabilities: WIX_CAPABILITIES,
  connectFields: [
    { key: "siteId", label: "Site ID", type: "text", placeholder: "1a2b3c4d-…", help: "Open your site's dashboard; the Site ID is the long code after /dashboard/ in the browser address bar." },
    { key: "siteUrl", label: "Website URL", type: "url", required: false, placeholder: "https://www.example.com", help: "Your published site address. Defaults to the project's website." },
    { key: "blogPrefix", label: "Blog post URL prefix", type: "text", required: false, placeholder: "/post/", help: "Leave empty unless you changed it — Wix blog posts live at /post/<slug> by default." },
    { key: "apiKey", label: "API key", type: "password", help: "Created in the Wix API Keys Manager. Stored encrypted; we never show it again." },
  ],
  setupSteps: [
    "Sign in to Wix as the site owner (or a co-owner) and open manage.wix.com/account/api-keys (Account settings → API Keys Manager).",
    "Click \"Generate API Key\" and name it (for example \"SEO assistant\").",
    "Under permissions, choose the site you are connecting and tick only: \"Wix Blog\" (Manage Blog) and \"Site Properties\" (Read Site Properties / Manage Site Settings). No payments, stores, contacts or members permissions are needed.",
    "Click Generate and copy the key — it is shown only once.",
    "Open the site's dashboard and copy the Site ID from the address bar (the code after /dashboard/).",
    "Paste both here and click Connect. We run a read-only check of the site's name first.",
    "Blog post edits appear as unpublished changes on the post — publish them from Blog → Posts. Static pages (home, about, services…) cannot be changed through Wix's API; we give you exact text to paste into Page settings → SEO basics instead.",
    "To disconnect, delete the key in the API Keys Manager.",
  ],
  create(config, secrets, context) {
    const apiKey = String(secrets?.apiKey ?? "");
    const cfg = buildConfig({ ...(config as unknown as Record<string, unknown>), apiKey }, context?.projectWebsiteUrl);
    return new WixConnector(cfg, { apiKey });
  },
  validateConfig(input, context) {
    const config = buildConfig(input, context?.projectWebsiteUrl);
    return { config, secrets: { apiKey: String(input.apiKey).trim() } };
  },
};
