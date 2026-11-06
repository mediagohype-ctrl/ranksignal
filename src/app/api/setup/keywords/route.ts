// POST /api/setup/keywords {facts, website} — SEO keyword ideas for setup screen 3: some pre-ticked, some extra.
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { suggestKeywords } from "@/lib/setup/keywords";
import { factsBody, SETUP_RATE, websiteSchema } from "../schemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ facts: factsBody, website: websiteSchema });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  if (!checkRateLimit(`setup:${s.userId}`, SETUP_RATE.limit, SETUP_RATE.windowMs).allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries in a short time. Wait a few minutes, then try again.");
  }
  const { facts, website } = await parseBody(req, bodySchema);
  const r = await suggestKeywords(facts, new URL(website).hostname);
  return json({ item: r });
});
