// POST /api/public/tool-lead { tool, email, url? } — optional email box on the free mini tools (/tools/*).
// Saves a Lead (source "tool:<name>") for the admin CRM. Per-IP + global rate limits; a hidden "website" field
// catches bots. Unauthenticated (under /api/public, same-origin check still applies in middleware).
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/admin/leads";
import { isDisposableEmail } from "@/lib/security/email-policy";
import { isToolName, toolLeadSource } from "@/lib/growth/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

const bodySchema = z.object({
  tool: z.string().max(64),
  email: z.string().trim().toLowerCase().email().max(254),
  url: z.string().max(2048).optional(),
  /** Honeypot: real people never fill it. */
  website: z.string().max(200).optional(),
});

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!isToolName(body.tool)) throw new HttpError(400, "invalid_tool", "Unknown tool.");
  if (body.website) return json({ ok: true });
  const ip = clientIp(req);
  if (!checkRateLimit(`tool-lead:ip:${ip}`, 5, HOUR).allowed || !checkRateLimit("tool-lead:global", 200, HOUR).allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries from this connection. Please try again later.");
  }
  if (isDisposableEmail(body.email)) {
    throw new HttpError(400, "disposable_email", "Please use an email address you check — temporary inboxes can't get our tips.");
  }
  try {
    await db.lead.create({
      data: {
        source: toolLeadSource(body.tool),
        email: body.email,
        url: body.url ? body.url.slice(0, 2048) : null,
        ipHash: hashIp(ip),
      },
    });
  } catch (e) {
    console.warn("[tool-lead] could not record lead", (e as Error)?.name ?? "error");
  }
  return json({ ok: true });
});
