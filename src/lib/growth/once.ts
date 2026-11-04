// Send-once guard for growth messages (trial nudges, weekly emails, WhatsApp updates, alerts).
// SentMessage has @@unique([kind, key]): the first caller to insert the row "owns" the send; a unique violation
// means someone (another tick, another instance) already sent it.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SentChannel = "email" | "whatsapp" | "staff";

export function isUniqueViolation(e: unknown): boolean {
  return (
    (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") ||
    (!!e && typeof e === "object" && (e as { code?: string }).code === "P2002")
  );
}

/** Claim (kind, key). true = we own the send; false = already sent. Other DB errors propagate. */
export async function claimOnce(o: { kind: string; key: string; organizationId?: string | null; channel: SentChannel }): Promise<boolean> {
  try {
    await db.sentMessage.create({
      data: { kind: o.kind, key: o.key, organizationId: o.organizationId ?? null, channel: o.channel },
    });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/** Undo a claim when nothing was delivered, so the next tick can retry. Never throws. */
export async function releaseClaim(kind: string, key: string): Promise<void> {
  await db.sentMessage.deleteMany({ where: { kind, key } }).catch(() => undefined);
}

/** Record (kind, key) as handled when there was nothing to send, so later ticks skip the work. Never throws. */
export async function markHandled(o: { kind: string; key: string; organizationId?: string | null; channel: SentChannel }): Promise<void> {
  await claimOnce(o).catch(() => false);
}

/** Which of `keys` were already sent for `kind` (one query; used to skip work before building messages). */
export async function alreadySent(kind: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db.sentMessage.findMany({ where: { kind, key: { in: keys } }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}
