import { handler, requireSession, HttpError } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { buildAccountExport } from "@/lib/auth/account";
import { writeAuditLog } from "@/lib/audit-log";

/** GET — download my data as JSON (profile, memberships, and for owned workspaces their project data). */
export const GET = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  if (!checkRateLimit(`export:${s.userId}`, 5, 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "You've downloaded your data several times recently. Please try again in an hour.");
  }
  const data = await buildAccountExport(s.userId);
  if (!data) throw new HttpError(404, "not_found", "Account not found");
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "account.data_exported",
    resourceType: "user",
    resourceId: s.userId,
    ip: clientIp(req),
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
