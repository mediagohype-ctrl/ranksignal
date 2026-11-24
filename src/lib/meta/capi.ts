// Meta Conversions API: sends key business events (free check, sign-up, payment…) from our server to Meta so
// Instagram / Facebook ads can optimise for real results. Off until META_CAPI_TOKEN is set. META_PIXEL_ID overrides
// the default pixel below (digits only); META_PIXEL_ID=off switches Meta off entirely.
// Best-effort: never throws, never slows the visitor's request (fire-and-forget, 4s timeout).
//
// Privacy: email and phone are SHA-256 hashed before sending (Meta's rule); the IP and browser user agent are sent
// as Meta requires for website events. We never send page contents or check results.
import { createHash, randomUUID } from "node:crypto";
import { clientIp } from "@/lib/auth/rate-limit";

const GRAPH_VERSION = "v21.0";

/** MyWebRank's Meta Pixel / Dataset ID (public: it is in every page's HTML). Override with META_PIXEL_ID. */
export const DEFAULT_META_PIXEL_ID = "4537219149865300";

/**
 * The pixel to use: META_PIXEL_ID when it is a real id (digits), "" when it is "off", otherwise our default.
 * A missing, empty or mistyped value (e.g. a copied placeholder) falls back to the default instead of silently
 * switching Meta off.
 */
export function metaPixelId(env: Record<string, string | undefined> = process.env): string {
  const v = (env.META_PIXEL_ID ?? env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
  if (/^off$/i.test(v)) return "";
  return /^\d{5,20}$/.test(v) ? v : DEFAULT_META_PIXEL_ID;
}

export type MetaEventName = "Lead" | "SubmitApplication" | "Contact" | "CompleteRegistration" | "Subscribe" | "Purchase" | "ViewContent" | "StartTrial" | "Schedule";

export interface MetaEvent {
  name: MetaEventName;
  /** Same id for the same real event (Meta drops duplicates within 48h), e.g. "subscribe-sub_123". */
  eventId?: string;
  /** Page the action happened on (website events). */
  sourceUrl?: string | null;
  /** "website" when a visitor did it (needs userAgent); "system_generated" for payments confirmed by Razorpay. */
  actionSource?: "website" | "system_generated";
  user?: {
    email?: string | null;
    phone?: string | null;
    /** Our own id for this person/organization (hashed). */
    externalId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    /** _fbp / _fbc cookies set by the Meta Pixel / ad click. */
    fbp?: string | null;
    fbc?: string | null;
    country?: string | null;
  };
  custom?: { value?: number; currency?: string; content_name?: string; [k: string]: unknown };
}

export function metaConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(metaPixelId(env) && env.META_CAPI_TOKEN?.trim());
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const norm = (v: string | null | undefined) => (v ? v.trim().toLowerCase() : "");

/** Meta's user_data: hashed identifiers, plain ip / user agent / cookies. Empty fields are left out. */
export function metaUserData(u: MetaEvent["user"] = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const email = norm(u.email);
  if (email) out.em = [sha256(email)];
  const phone = (u.phone ?? "").replace(/\D/g, "");
  if (phone) out.ph = [sha256(phone.length === 10 ? `91${phone}` : phone)];
  if (u.externalId) out.external_id = [sha256(u.externalId)];
  const country = norm(u.country);
  if (country.length === 2) out.country = [sha256(country)];
  if (u.ip && u.ip !== "unknown") out.client_ip_address = u.ip;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return out;
}

/** The request body Meta expects (exported for tests). */
export function metaPayload(e: MetaEvent, now = Date.now(), testCode = process.env.META_TEST_EVENT_CODE): Record<string, unknown> {
  const event: Record<string, unknown> = {
    event_name: e.name,
    event_time: Math.floor(now / 1000),
    event_id: e.eventId ?? randomUUID(),
    action_source: e.actionSource ?? "website",
    user_data: metaUserData(e.user),
  };
  if (e.sourceUrl) event.event_source_url = e.sourceUrl;
  if (e.custom && Object.keys(e.custom).length) event.custom_data = e.custom;
  return { data: [event], ...(testCode?.trim() ? { test_event_code: testCode.trim() } : {}) };
}

/** Send one event. Resolves when done (or failed); never throws. */
export async function sendMetaEvent(e: MetaEvent): Promise<boolean> {
  if (!metaConfigured()) return false;
  const pixel = metaPixelId();
  const token = process.env.META_CAPI_TOKEN!.trim();
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload(e)),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Log Meta's error message only (never the token or user data).
      const msg = /"message":"([^"]{0,200})/.exec(body)?.[1] ?? `HTTP ${res.status}`;
      console.warn(`[meta] ${e.name} not accepted: ${msg}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[meta] ${e.name} failed: ${(err as Error)?.name ?? "error"}`);
    return false;
  }
}

/** Fire-and-forget: the caller never waits for Meta. */
export function trackMeta(e: MetaEvent): void {
  if (!metaConfigured()) return;
  void sendMetaEvent(e);
}

function cookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header);
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Visitor details from a request: IP, user agent, the Meta cookies, and the page the visitor was on.
 * When the visitor came from an ad (fbclid in the page address) but has no _fbc cookie yet, build _fbc from it.
 */
export function metaVisitor(req: Request): { user: NonNullable<MetaEvent["user"]>; sourceUrl: string | null } {
  const h = req.headers;
  const cookies = h.get("cookie");
  const referer = h.get("referer");
  let fbc = cookie(cookies, "_fbc");
  if (!fbc && referer) {
    try {
      const fbclid = new URL(referer).searchParams.get("fbclid");
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch {
      /* ignore */
    }
  }
  return {
    user: {
      ip: clientIp(req),
      userAgent: h.get("user-agent"),
      fbp: cookie(cookies, "_fbp"),
      fbc,
      country: h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country"),
    },
    sourceUrl: referer,
  };
}
