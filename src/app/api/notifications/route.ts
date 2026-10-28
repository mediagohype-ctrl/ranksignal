import { handler, json, requireSession } from "@/lib/api";
import { db } from "@/lib/db";

// Org-wide notifications plus those addressed to the current user.
export const GET = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const where = {
    organizationId: s.organizationId,
    OR: [{ userId: null }, { userId: s.userId }],
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return json({ items, unreadCount });
});
