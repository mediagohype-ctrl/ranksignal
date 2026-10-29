// Sanity connector descriptor (ROUND 5 connector plugin contract).
import { z } from "zod";
import { SANITY_CAPABILITIES, SanityConnector, type SanityConfig, type SanitySecrets } from "@/lib/connectors/sanity";
import { checkSiteUrl, optionalFieldId, parseUrlMap } from "@/lib/connectors/catalog/contentful";
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";

export const SANITY_DEFAULT_API_VERSION = "2025-02-19";

const inputSchema = z.object({
  projectId: z.string().trim().regex(/^[a-z0-9-]{1,64}$/i),
  dataset: z.string().trim().regex(/^[a-z0-9_-]{1,64}$/i).optional().or(z.literal("")),
  apiVersion: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  token: z.string().trim().min(20).max(1000),
});

function buildConfig(input: Record<string, unknown>, fallbackSite?: string): SanityConfig {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const msg: Record<string, string> = {
      projectId: "Enter the Project ID shown at sanity.io/manage (8 letters/numbers).",
      dataset: "Dataset names may only contain letters, numbers, dashes and underscores.",
      apiVersion: "API version must be a date like 2025-02-19.",
      token: "Paste the full API token.",
    };
    throw new ConnectorConfigError(msg[field] ?? "Check the Sanity connection details.", field || undefined);
  }
  const fm = (input.fieldMap ?? {}) as Record<string, unknown>;
  const title = optionalFieldId(fm.title ?? input.titleField, "titleField");
  const description = optionalFieldId(fm.description ?? input.descriptionField, "descriptionField");
  if (!title || !description) {
    throw new ConnectorConfigError("Enter the field names that hold the SEO title and meta description.", title ? "descriptionField" : "titleField");
  }
  return {
    projectId: parsed.data.projectId,
    dataset: parsed.data.dataset || "production",
    apiVersion: parsed.data.apiVersion || SANITY_DEFAULT_API_VERSION,
    siteUrl: checkSiteUrl(input.siteUrl, fallbackSite),
    urlMap: parseUrlMap(input.urlMap, "type"),
    fieldMap: {
      title,
      description,
      body: optionalFieldId(fm.body ?? input.bodyField, "bodyField"),
      faq: optionalFieldId(fm.faq ?? input.faqField, "faqField"),
    },
  };
}

export const descriptor: ConnectorDescriptor<SanityConfig, SanitySecrets> = {
  id: "sanity",
  family: "Headless CMS",
  name: "Sanity",
  status: "available",
  description:
    "Update SEO titles, meta descriptions and text fields on Sanity documents. Changes go into the document's draft — your live site is unchanged until you publish in Sanity Studio — with revision-based rollback.",
  capabilities: SANITY_CAPABILITIES,
  connectFields: [
    { key: "projectId", label: "Project ID", type: "text", placeholder: "a1b2c3d4", help: "Shown on your project page at sanity.io/manage and in sanity.config.ts." },
    { key: "dataset", label: "Dataset", type: "text", required: false, placeholder: "production", help: "Leave empty for \"production\"." },
    { key: "apiVersion", label: "API version", type: "text", required: false, placeholder: SANITY_DEFAULT_API_VERSION, help: `A date. Leave empty to use ${SANITY_DEFAULT_API_VERSION}.` },
    { key: "siteUrl", label: "Website URL", type: "url", required: false, placeholder: "https://www.example.com", help: "The public site that shows this content. Defaults to the project's website." },
    {
      key: "urlMap", label: "URL map", type: "text", placeholder: "/blog=post:slug, /=page:slug",
      help: "How your web addresses map to document types: URL prefix = document type : slug field. Separate entries with commas. Example: /blog=post:slug means https://site/blog/my-post is the \"post\" document whose slug is \"my-post\".",
    },
    { key: "titleField", label: "SEO title field", type: "text", placeholder: "seo.metaTitle", help: "Field name (dots for nested fields) holding the page title, as written in your schema." },
    { key: "descriptionField", label: "Meta description field", type: "text", placeholder: "seo.metaDescription", help: "Field name holding the meta description." },
    { key: "bodyField", label: "Body field", type: "text", required: false, help: "Optional. Only plain string/text fields can be edited; Portable Text is left alone." },
    { key: "faqField", label: "FAQ field", type: "text", required: false, help: "Optional. A text field holding FAQ copy." },
    { key: "token", label: "API token", type: "password", help: "A token with Editor permissions. Stored encrypted; we never show it again." },
  ],
  setupSteps: [
    "Go to sanity.io/manage and open your project.",
    "Open the API tab → Tokens → \"Add API token\".",
    "Name it (for example \"SEO assistant\") and choose the \"Editor\" permission — it needs read and write access to create drafts. Do not choose Administrator/Deploy Studio; they are not needed.",
    "Copy the token (it is shown only once). Note your Project ID and dataset name (usually \"production\") from the same page.",
    "Write the URL map: for each section of your site, its URL prefix, document type and slug field — e.g. /blog=post:slug.",
    "Enter the field names holding your SEO title and meta description, then click Connect. We run a read-only count query first.",
    "Our changes appear as drafts in Sanity Studio. Review and press Publish when you are happy. To disconnect, delete the token in sanity.io/manage.",
  ],
  create(config, secrets, context) {
    const token = String(secrets?.token ?? "");
    const cfg = buildConfig({ ...(config as unknown as Record<string, unknown>), token }, context?.projectWebsiteUrl);
    return new SanityConnector(cfg, { token });
  },
  validateConfig(input, context) {
    const config = buildConfig(input, context?.projectWebsiteUrl);
    return { config, secrets: { token: String(input.token).trim() } };
  },
};
