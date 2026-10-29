// Read-only Search Console + GA4 API calls (fixed Google hosts).
import { googleFetch } from "./http";

// ---- Search Console ----------------------------------------------------------------------------------------------

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const r = await googleFetch<{ siteEntry?: { siteUrl?: string; permissionLevel?: string }[] }>(
    "https://www.googleapis.com/webmasters/v3/sites",
    { accessToken },
  );
  return (r?.siteEntry ?? [])
    .filter((s): s is { siteUrl: string; permissionLevel?: string } => typeof s.siteUrl === "string")
    .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel ?? "unknown" }));
}

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/**
 * Best Search Console property for a website: a Domain property (sc-domain:example.com) first, then the exact
 * URL-prefix property for the site's origin, then any URL-prefix property on the same host. Null when none match.
 */
export function matchGscSite(sites: GscSite[], websiteUrl: string): string | null {
  let target: URL;
  try {
    target = new URL(websiteUrl);
  } catch {
    return null;
  }
  const host = bareHost(target.hostname);
  const domain = sites.find((s) => s.siteUrl.toLowerCase() === `sc-domain:${host}`);
  if (domain) return domain.siteUrl;
  // A parent domain property (sc-domain:example.com for shop.example.com) also covers the site.
  const parent = sites.find((s) => s.siteUrl.toLowerCase().startsWith("sc-domain:") && host.endsWith(`.${s.siteUrl.slice(10).toLowerCase()}`));
  const prefix = sites.filter((s) => /^https?:\/\//i.test(s.siteUrl));
  const exact = prefix.find((s) => {
    try {
      const u = new URL(s.siteUrl);
      return u.origin === target.origin && (u.pathname === "/" || u.pathname === "");
    } catch {
      return false;
    }
  });
  if (exact) return exact.siteUrl;
  if (parent) return parent.siteUrl;
  const sameHost = prefix.find((s) => {
    try {
      return bareHost(new URL(s.siteUrl).hostname) === host;
    } catch {
      return false;
    }
  });
  return sameHost?.siteUrl ?? null;
}

export interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export async function gscQuery(
  accessToken: string,
  siteUrl: string,
  body: { startDate: string; endDate: string; dimensions: string[]; rowLimit?: number; startRow?: number; dataState?: "final" | "all" },
): Promise<GscRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const r = await googleFetch<{ rows?: GscRow[] }>(url, { accessToken, json: { type: "web", ...body }, timeoutMs: 45_000 });
  return r?.rows ?? [];
}

// ---- GA4 -----------------------------------------------------------------------------------------------------------

export interface Ga4Property {
  propertyId: string; // "properties/123456"
  displayName: string;
  account: string;
}

export async function listGa4Properties(accessToken: string): Promise<Ga4Property[]> {
  const out: Ga4Property[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const u = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    u.searchParams.set("pageSize", "200");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const r = await googleFetch<{
      accountSummaries?: { displayName?: string; propertySummaries?: { property?: string; displayName?: string }[] }[];
      nextPageToken?: string;
    }>(u.toString(), { accessToken });
    for (const a of r?.accountSummaries ?? []) {
      for (const p of a.propertySummaries ?? []) {
        if (typeof p.property === "string" && /^properties\/\d+$/.test(p.property)) {
          out.push({ propertyId: p.property, displayName: p.displayName ?? p.property, account: a.displayName ?? "" });
        }
      }
    }
    pageToken = r?.nextPageToken || undefined;
    if (!pageToken) break;
  }
  return out;
}

export interface Ga4Report {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
}

export async function ga4RunReport(accessToken: string, propertyId: string, body: Record<string, unknown>): Promise<Ga4Report> {
  if (!/^properties\/\d+$/.test(propertyId)) throw new Error("Invalid GA4 property id");
  return googleFetch<Ga4Report>(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
    accessToken,
    json: body,
    timeoutMs: 45_000,
  });
}
