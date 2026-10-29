// GET /api/integrations/google/properties?projectId=…&product=gsc|ga4 — properties the connected Google account can
// read (Search Console sites or GA4 properties) plus a suggested match for the project's website. Admin+.
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { assertGoogleConfigured } from "@/lib/google/config";
import { listGa4Properties, listGscSites, matchGscSite } from "@/lib/google/api";
import { accessTokenFor, findGoogleIntegration, readGoogleConfig } from "@/lib/google/integration";
import { productSchema, projectIdSchema, toHttpError } from "@/lib/google/route-helpers";

export const dynamic = "force-dynamic";

interface PropertyOption {
  id: string;
  label: string;
  detail: string;
}

export const GET = handler(async (req: Request) => {
  assertGoogleConfigured();
  const s = await requireSession("admin");
  const q = new URL(req.url).searchParams;
  const pid = projectIdSchema.safeParse(q.get("projectId"));
  const product = productSchema.safeParse(q.get("product"));
  if (!pid.success || !product.success) throw new HttpError(400, "invalid_request", "projectId and product are required");
  const project = await requireProject(s, pid.data);
  const row = await findGoogleIntegration(s.organizationId, project.id, product.data);
  if (!row?.credentialEncrypted) throw new HttpError(409, "not_connected", "Connect your Google account first.");
  const cfg = readGoogleConfig(row.config);

  try {
    const token = await accessTokenFor(row);
    if (product.data === "gsc") {
      const sites = await listGscSites(token);
      const items: PropertyOption[] = sites.map((x) => ({
        id: x.siteUrl,
        label: x.siteUrl.startsWith("sc-domain:") ? `${x.siteUrl.slice(10)} (whole domain)` : x.siteUrl,
        detail: x.permissionLevel.replace(/^site/, "").replace(/([A-Z])/g, " $1").trim().toLowerCase(),
      }));
      return json({ items, suggested: matchGscSite(sites, project.websiteUrl), selected: cfg.siteUrl ?? null });
    }
    const props = await listGa4Properties(token);
    const items: PropertyOption[] = props.map((p) => ({ id: p.propertyId, label: p.displayName, detail: `${p.account} · ID ${p.propertyId.slice(11)}` }));
    return json({ items, suggested: items.length === 1 ? items[0]!.id : null, selected: cfg.propertyId ?? null });
  } catch (e) {
    throw toHttpError(e);
  }
});
