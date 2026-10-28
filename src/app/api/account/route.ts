import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

/** GET — the signed-in user's own profile. */
export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const item = await db.user.findUniqueOrThrow({
    where: { id: s.userId },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  });
  return json({ item });
});

const patchSchema = z.object({ name: z.string().trim().min(1, "Enter your name.").max(120) });

/** PATCH {name} — update display name. */
export const PATCH = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const { name } = await parseBody(req, patchSchema);
  const before = await db.user.findUniqueOrThrow({ where: { id: s.userId }, select: { name: true } });
  const item = await db.user.update({
    where: { id: s.userId },
    data: { name },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "account.name_changed",
    resourceType: "user",
    resourceId: s.userId,
    before: { name: before.name },
    after: { name },
  });
  return json({ item });
});
