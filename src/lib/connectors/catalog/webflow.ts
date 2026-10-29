// Webflow connector descriptor (ROUND 5 connector plugin contract).
import { z } from "zod";
import {
  WebflowConnector, WEBFLOW_CAPABILITIES, sanitizeFieldMap,
  type WebflowConfig, type WebflowFieldMap, type WebflowSecrets,
} from "@/lib/connectors/webflow";
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";

const optionalSlug = z.string().trim().max(64).optional();
const inputSchema = z.object({
  siteId: z.string().trim().regex(/^[a-f0-9]{24}$/i),
  siteUrl: z.string().trim().max(500).optional(),
  token: z.string().trim().min(20).max(500),
  seoTitleField: optionalSlug,
  metaDescriptionField: optionalSlug,
  ogTitleField: optionalSlug,
  ogDescriptionField: optionalSlug,
  contentField: optionalSlug,
  fieldMap: z.record(z.string()).optional(),
});

function checkSiteUrl(raw: string | undefined, fallback: string | undefined): string {
  const candidate = raw || fallback;
  if (!candidate) throw new ConnectorConfigError("Enter your site's public URL, e.g. https://www.example.com", "siteUrl");
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new ConnectorConfigError("Site URL must be a full https:// address, e.g. https://www.example.com", "siteUrl");
  }
  if (u.protocol !== "https:") throw new ConnectorConfigError("Site URL must use https://", "siteUrl");
  return u.origin;
}

export const descriptor: ConnectorDescriptor<WebflowConfig, WebflowSecrets> = {
  id: "webflow",
  family: "Website builder",
  name: "Webflow",
  status: "available",
  description:
    "Update page SEO titles, meta descriptions and Open Graph text, plus mapped CMS item fields. Changes are staged — nothing goes live until you publish in Webflow — and every change records a before-state for rollback.",
  capabilities: WEBFLOW_CAPABILITIES,
  connectFields: [
    {
      key: "siteId",
      label: "Site ID",
      type: "text",
      placeholder: "24-character ID",
      help: "Webflow → Site settings → General → Overview, \"Site ID\".",
    },
    {
      key: "siteUrl",
      label: "Site URL",
      type: "url",
      required: false,
      placeholder: "https://www.example.com",
      help: "Your live domain. Used to match audited pages to Webflow pages and CMS items. Defaults to the project's website.",
    },
    {
      key: "token",
      label: "Site API token",
      type: "password",
      help: "Created under Site settings → Apps & integrations → API access. Stored encrypted; we never display it again.",
    },
    {
      key: "seoTitleField",
      label: "CMS field for SEO title (optional)",
      type: "text",
      required: false,
      placeholder: "seo-title",
      help: "The field slug in your CMS collections that holds the SEO title. Leave blank to keep CMS titles read-only.",
    },
    {
      key: "metaDescriptionField",
      label: "CMS field for meta description (optional)",
      type: "text",
      required: false,
      placeholder: "meta-description",
      help: "The field slug that holds the meta description (Collection settings → field → slug).",
    },
    {
      key: "contentField",
      label: "CMS rich-text body field (optional)",
      type: "text",
      required: false,
      placeholder: "post-body",
      help: "Only map this if you want body text edits proposed for CMS items; every body edit needs your approval.",
    },
  ],
  setupSteps: [
    "In Webflow open your site's Site settings → Apps & integrations, scroll to API access and click \"Generate API token\".",
    "Name it (for example \"SEO assistant\") and set exactly these permissions: Sites — Read-only; Pages — Read and write; CMS — Read and write. Leave everything else (Forms, Ecommerce, Users, Custom code, Site activity) as No access.",
    "Copy the token (it is shown once) and your Site ID from Site settings → General.",
    "Optional: if your CMS collections have SEO fields, note their field slugs (Collection settings → click the field) and enter them below so CMS items can be updated.",
    "Paste the details here and click Connect. We first run a read-only check that the token can see your site.",
    "Changes are saved as staged edits. They go live only when you publish the site in Webflow — we never publish for you.",
    "To disconnect later, delete the token under API access — that revokes it immediately.",
  ],
  create(config, secrets, context) {
    const siteUrl = checkSiteUrl(config?.siteUrl, context?.projectWebsiteUrl);
    return new WebflowConnector(
      { siteId: String(config?.siteId ?? ""), siteUrl, fieldMap: sanitizeFieldMap(config?.fieldMap) },
      { token: String(secrets?.token ?? "") },
    );
  },
  validateConfig(input, context) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      const msg = field === "siteId"
        ? "The Site ID is a 24-character code from Site settings → General."
        : field === "token"
          ? "Paste the site API token from Site settings → Apps & integrations → API access."
          : "Check the Webflow connection details.";
      throw new ConnectorConfigError(msg, field || undefined);
    }
    const d = parsed.data;
    const raw: Record<string, unknown> = { ...(d.fieldMap ?? {}) };
    if (d.seoTitleField) raw.title = d.seoTitleField;
    if (d.metaDescriptionField) raw.meta_description = d.metaDescriptionField;
    if (d.ogTitleField) raw.og_title = d.ogTitleField;
    if (d.ogDescriptionField) raw.og_description = d.ogDescriptionField;
    if (d.contentField) raw.content = d.contentField;
    const fieldMap: WebflowFieldMap = sanitizeFieldMap(raw);
    const siteUrl = checkSiteUrl(d.siteUrl, context?.projectWebsiteUrl);
    return { config: { siteId: d.siteId.toLowerCase(), siteUrl, fieldMap }, secrets: { token: d.token } };
  },
};
