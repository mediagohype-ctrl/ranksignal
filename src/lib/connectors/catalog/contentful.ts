// Contentful connector descriptor (ROUND 5 connector plugin contract).
import { z } from "zod";
import {
  CONTENTFUL_CAPABILITIES, ContentfulConnector,
  type ContentfulConfig, type ContentfulSecrets, type ContentfulUrlMapEntry,
} from "@/lib/connectors/contentful";
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";

const ID = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * Parse a URL map typed into one text box: "<url prefix>=<type>[:<slug field>]" entries separated by
 * commas or new lines, e.g. "/blog=blogPost:slug, /=page". The slug field defaults to "slug".
 * Also accepts an already-structured array.
 */
export function parseUrlMap(raw: unknown, typeKey: "contentType" | "type", field = "urlMap"): { urlPrefix: string; type: string; slugField: string }[] {
  type Row = { urlPrefix?: unknown; slugField?: unknown } & Record<string, unknown>;
  const rows: Row[] = Array.isArray(raw)
    ? (raw as Row[])
    : String(raw ?? "")
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const eq = s.indexOf("=");
          if (eq < 0) throw new ConnectorConfigError(`URL map entry "${s}" must look like /blog=blogPost:slug`, field);
          const [type, slugField] = s.slice(eq + 1).trim().split(":");
          return { urlPrefix: s.slice(0, eq).trim(), [typeKey]: type?.trim(), slugField: (slugField ?? "slug").trim() };
        });
  if (!rows.length) throw new ConnectorConfigError("Add at least one URL map entry, e.g. /blog=blogPost:slug", field);
  if (rows.length > 20) throw new ConnectorConfigError("At most 20 URL map entries are supported", field);
  return rows.map((r) => {
    const urlPrefix = "/" + String(r.urlPrefix ?? "").trim().replace(/^\/+|\/+$/g, "");
    const type = String(r[typeKey] ?? "").trim();
    const slugField = String(r.slugField ?? "slug").trim();
    if (!/^\/[A-Za-z0-9/_~.-]*$/.test(urlPrefix)) throw new ConnectorConfigError(`Invalid URL prefix "${urlPrefix}"`, field);
    if (!/^[A-Za-z_][A-Za-z0-9_.]{0,63}$/.test(type) || !/^[A-Za-z_][A-Za-z0-9_.]{0,63}$/.test(slugField)) {
      throw new ConnectorConfigError(`Invalid type or slug field in URL map entry for "${urlPrefix}"`, field);
    }
    return { urlPrefix, type, slugField };
  });
}

export function checkSiteUrl(raw: unknown, fallback: string | undefined, field = "siteUrl"): string {
  const candidate = (typeof raw === "string" && raw.trim()) || fallback;
  if (!candidate) throw new ConnectorConfigError("Enter your public website address, e.g. https://www.example.com", field);
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new ConnectorConfigError("Website URL must be a full https:// address", field);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ConnectorConfigError("Website URL must start with https://", field);
  return u.origin;
}

export function optionalFieldId(raw: unknown, key: string): string | undefined {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return undefined;
  if (!/^[A-Za-z_][A-Za-z0-9_.]{0,63}$/.test(v)) throw new ConnectorConfigError(`"${v}" is not a valid field ID`, key);
  return v;
}

const inputSchema = z.object({
  spaceId: z.string().trim().regex(ID),
  environmentId: z.string().trim().regex(ID).optional().or(z.literal("")),
  locale: z.string().trim().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).optional().or(z.literal("")),
  managementToken: z.string().trim().min(20).max(500),
});

function buildConfig(input: Record<string, unknown>, fallbackSite?: string): ContentfulConfig {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const msg: Record<string, string> = {
      spaceId: "Enter the Space ID (Settings → General settings in Contentful).",
      environmentId: "Environment ID may only contain letters, numbers, dashes and dots.",
      locale: "Locale should look like en-US.",
      managementToken: "Paste the full Content Management API personal access token (it starts with CFPAT-).",
    };
    throw new ConnectorConfigError(msg[field] ?? "Check the Contentful connection details.", field || undefined);
  }
  const fm = (input.fieldMap ?? {}) as Record<string, unknown>;
  const title = optionalFieldId(fm.title ?? input.titleField, "titleField");
  const description = optionalFieldId(fm.description ?? input.descriptionField, "descriptionField");
  if (!title || !description) {
    throw new ConnectorConfigError("Enter the field IDs that hold the SEO title and meta description.", title ? "descriptionField" : "titleField");
  }
  const urlMap: ContentfulUrlMapEntry[] = parseUrlMap(input.urlMap, "contentType").map((m) => ({
    urlPrefix: m.urlPrefix, contentType: m.type, slugField: m.slugField,
  }));
  return {
    spaceId: parsed.data.spaceId,
    environmentId: parsed.data.environmentId || "master",
    locale: parsed.data.locale || "en-US",
    siteUrl: checkSiteUrl(input.siteUrl, fallbackSite),
    urlMap,
    fieldMap: {
      title,
      description,
      body: optionalFieldId(fm.body ?? input.bodyField, "bodyField"),
      faq: optionalFieldId(fm.faq ?? input.faqField, "faqField"),
    },
  };
}

export const descriptor: ConnectorDescriptor<ContentfulConfig, ContentfulSecrets> = {
  id: "contentful",
  family: "Headless CMS",
  name: "Contentful",
  status: "available",
  description:
    "Update SEO titles, meta descriptions and text content on Contentful entries. Changes are saved as unpublished versions — nothing goes live until you publish in Contentful — and the previous values are kept for rollback.",
  capabilities: CONTENTFUL_CAPABILITIES,
  connectFields: [
    { key: "spaceId", label: "Space ID", type: "text", placeholder: "abc123xyz", help: "In Contentful: Settings → General settings → Space ID." },
    { key: "environmentId", label: "Environment", type: "text", required: false, placeholder: "master", help: "Leave empty to use \"master\"." },
    { key: "siteUrl", label: "Website URL", type: "url", required: false, placeholder: "https://www.example.com", help: "The public site that shows this content. Defaults to the project's website." },
    { key: "locale", label: "Locale", type: "text", required: false, placeholder: "en-US", help: "The locale to edit (Settings → Locales). Leave empty for en-US." },
    {
      key: "urlMap", label: "URL map", type: "text", placeholder: "/blog=blogPost:slug, /=page:slug",
      help: "How your web addresses map to content types: URL prefix = content type ID : slug field ID. Separate entries with commas. Example: /blog=blogPost:slug means https://site/blog/my-post is the blogPost entry whose slug field is \"my-post\".",
    },
    { key: "titleField", label: "SEO title field ID", type: "text", placeholder: "seoTitle", help: "Field ID (not the display name) that holds the page title. Find it under Content model → your type → field → Field ID." },
    { key: "descriptionField", label: "Meta description field ID", type: "text", placeholder: "seoDescription", help: "Field ID that holds the meta description." },
    { key: "bodyField", label: "Body field ID", type: "text", required: false, placeholder: "body", help: "Optional. Only plain text / Markdown fields can be edited; Rich Text is left alone." },
    { key: "faqField", label: "FAQ field ID", type: "text", required: false, help: "Optional. A text field holding FAQ copy." },
    { key: "managementToken", label: "Personal access token", type: "password", placeholder: "CFPAT-…", help: "Content Management API token. Stored encrypted; we never show it again." },
  ],
  setupSteps: [
    "In Contentful, click the cog icon (top right) → CMA tokens (also listed as \"Personal access tokens\" under your account settings).",
    "Click \"Create personal access token\", name it (for example \"SEO assistant\"), choose an expiry and copy the token — it starts with CFPAT- and is shown only once.",
    "The token acts as you, so your Contentful user needs a role that can edit entries in this space (Editor or a custom role with edit permission on the content types you map). It does not need permission to publish, manage users or delete.",
    "Copy the Space ID from Settings → General settings, and note your environment (usually \"master\") and default locale (Settings → Locales).",
    "Write the URL map: for each section of your site, its URL prefix, the content type ID and the slug field ID — e.g. /blog=blogPost:slug.",
    "Enter the field IDs that hold your SEO title and meta description, then click Connect. We run a read-only check of the space first.",
    "Our changes appear in Contentful as unpublished changes on the entry. Review them and press Publish when you are happy. To disconnect, revoke the token in Contentful.",
  ],
  create(config, secrets, context) {
    const cfg = buildConfig({ ...(config as unknown as Record<string, unknown>), managementToken: String(secrets?.managementToken ?? "") }, context?.projectWebsiteUrl);
    return new ContentfulConnector(cfg, { managementToken: String(secrets?.managementToken ?? "") });
  },
  validateConfig(input, context) {
    const config = buildConfig(input, context?.projectWebsiteUrl);
    return { config, secrets: { managementToken: String(input.managementToken).trim() } };
  },
};
