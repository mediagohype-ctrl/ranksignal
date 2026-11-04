// GET: the signed-in person's preferences. PATCH {expertMode?, timeZone?}: change them (any role — they are personal).
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { mePatchSchema } from "@/lib/user-prefs";

const SELECT = { id: true, email: true, name: true, expertMode: true, timeZone: true } as const;

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const item = await db.user.findUniqueOrThrow({ where: { id: s.userId }, select: SELECT });
  return json({ item });
});

export const PATCH = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const body = await parseBody(req, mePatchSchema);
  const before = await db.user.findUniqueOrThrow({ where: { id: s.userId }, select: { expertMode: true, timeZone: true } });
  const item = await db.user.update({
    where: { id: s.userId },
    data: {
      ...(body.expertMode !== undefined ? { expertMode: body.expertMode } : {}),
      ...(body.timeZone !== undefined ? { timeZone: body.timeZone } : {}),
    },
    select: SELECT,
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "account.preferences_changed",
    resourceType: "user",
    resourceId: s.userId,
    before,
    after: { expertMode: item.expertMode, timeZone: item.timeZone },
  });
  return json({ item });
});
