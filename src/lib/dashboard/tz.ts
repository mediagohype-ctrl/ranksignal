// Server-side time zone lookup: dates are stored in UTC and shown in the user's own zone (User.timeZone).
// Pass the result to fmtDate/fmtDateTime/fmtRelative (./format.ts). Default: India time.
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/dashboard/format";

export { DEFAULT_TIME_ZONE };

const zoneForUser = cache(async (userId: string): Promise<string> => {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
    return u && isValidTimeZone(u.timeZone) ? u.timeZone : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
});

/** The signed-in user's IANA time zone, e.g. "Asia/Kolkata". Cached per request; never throws. */
export async function getUserTimeZone(session: { userId: string } | null | undefined): Promise<string> {
  return session?.userId ? zoneForUser(session.userId) : DEFAULT_TIME_ZONE;
}
