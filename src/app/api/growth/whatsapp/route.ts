// GET/PATCH /api/growth/whatsapp — the organization's WhatsApp updates setting (brief §9).
// PATCH { number, optIn }: Owner/Admin only; number is normalised to E.164 (a bare 10-digit Indian mobile gets +91).
// Turning updates on needs a valid number; number "" / null clears it (and turns updates off).
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import { formatE164, normalizeE164 } from "@/lib/growth/e164";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    number: z.string().max(32).nullable().optional(),
    optIn: z.boolean().optional(),
  })
  .strict();

function view(o: { whatsappNumber: string | null; whatsappOptIn: boolean }) {
  return {
    number: o.whatsappNumber,
    display: o.whatsappNumber ? formatE164(o.whatsappNumber) : null,
    optIn: o.whatsappOptIn && !!o.whatsappNumber,
  };
}

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const org = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { whatsappNumber: true, whatsappOptIn: true } });
  return json({ item: view(org) }, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const body = await parseBody(req, schema);
  const current = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { whatsappNumber: true, whatsappOptIn: true } });

  let number = current.whatsappNumber;
  if (body.number !== undefined) {
    if (body.number === null || body.number.trim() === "") number = null;
    else {
      const n = normalizeE164(body.number);
      if (!n) {
        throw new HttpError(400, "invalid_number", "Enter a WhatsApp number with the country code, like +91 98765 43210.", {
          fieldErrors: { number: ["Enter a WhatsApp number with the country code, like +91 98765 43210."] },
        });
      }
      number = n;
    }
  }
  let optIn = body.optIn ?? current.whatsappOptIn;
  if (!number) optIn = false;
  if (body.optIn === true && !number) {
    throw new HttpError(400, "number_required", "Add your WhatsApp number first.", { fieldErrors: { number: ["Add your WhatsApp number first."] } });
  }

  const org = await db.organization.update({
    where: { id: s.organizationId },
    data: { whatsappNumber: number, whatsappOptIn: optIn },
    select: { whatsappNumber: true, whatsappOptIn: true },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "org.whatsapp_updated",
    resourceType: "organization",
    resourceId: s.organizationId,
    // Never log the number itself.
    before: { optIn: current.whatsappOptIn, hasNumber: !!current.whatsappNumber },
    after: { optIn: org.whatsappOptIn, hasNumber: !!org.whatsappNumber },
  }).catch(() => undefined);
  return json({ item: view(org) });
});
