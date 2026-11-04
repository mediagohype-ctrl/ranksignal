// POST /api/setup/understand {website} — reads the homepage and returns guessed business facts for setup screen 2.
// Never fails because of the customer's site: an unreadable site returns empty facts plus a plain `problem` message.
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { understandWebsite } from "@/lib/setup/understand";
import { SETUP_RATE, websiteSchema } from "../schemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ website: websiteSchema });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  if (!checkRateLimit(`setup:${s.userId}`, SETUP_RATE.limit, SETUP_RATE.windowMs).allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries in a short time. Wait a few minutes, then try again.");
  }
  const { website } = await parseBody(req, bodySchema);
  const result = await understandWebsite(website);
  return json({ item: result });
});
