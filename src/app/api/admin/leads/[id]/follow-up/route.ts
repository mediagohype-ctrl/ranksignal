// POST /api/admin/leads/[id]/follow-up — staff "Send follow-up": one plain email to a free-check lead (score, top fix,
// sign-up link). Sent at most once per lead (SentMessage kind "lead_followup", key = lead id); marks the lead contacted.
import { handler, json, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { BRAND } from "@/lib/brand";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";
import { claimOnce, releaseClaim } from "@/lib/growth/once";
import { LEAD_FOLLOWUP_KIND, leadFollowupEmail } from "@/lib/admin/lead-followup";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("leads.manage");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { id: true, email: true, url: true, score: true, message: true, status: true } });
  if (!lead) throw new HttpError(404, "not_found", "Lead not found");
  if (!lead.email) throw new HttpError(400, "no_email", "This lead has no email address.");
  if (!isEmailConfigured()) throw new HttpError(503, "email_unavailable", "Email sending isn't set up (EMAIL_FROM + SMTP or Resend).");

  if (!(await claimOnce({ kind: LEAD_FOLLOWUP_KIND, key: lead.id, channel: "email" }))) {
    throw new HttpError(409, "already_sent", "A follow-up was already sent to this lead.");
  }
  const { subject, html, text } = leadFollowupEmail(lead);
  const res = await sendEmail({ to: lead.email, subject, html, text, replyTo: BRAND.supportEmail }).catch(() => ({ ok: false }));
  if (!res.ok) {
    await releaseClaim(LEAD_FOLLOWUP_KIND, lead.id);
    throw new HttpError(502, "send_failed", "The email could not be sent. Try again in a few minutes.");
  }

  const status = lead.status === "new" ? "contacted" : lead.status;
  const item = await db.lead.update({ where: { id }, data: { status } });
  await staffAudit(staff, req, {
    action: "admin.lead_followup_sent",
    resourceType: "lead",
    resourceId: id,
    before: { status: lead.status },
    after: { status, kind: LEAD_FOLLOWUP_KIND },
  });
  return json({ item });
});
