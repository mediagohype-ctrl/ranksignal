// Expert mode (brief 5.8): off by default. When on, screens show SEO/AEO/GEO pillar names and scores, risk classes
// and raw tables; when off, plain words only (docs/PLAIN_WORDS.md). Server-only (reads the User row).
import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/types";

const loadPrefs = cache(async (userId: string) => {
  const u = await db.user.findUnique({ where: { id: userId }, select: { expertMode: true, timeZone: true } });
  return { expertMode: u?.expertMode === true, timeZone: u?.timeZone ?? null };
});

/** Whether the signed-in person turned Expert mode on. Never throws (falls back to off). */
export async function getExpertMode(session: Pick<SessionContext, "userId">): Promise<boolean> {
  try {
    return (await loadPrefs(session.userId)).expertMode;
  } catch {
    return false;
  }
}

/** Expert mode + time zone (null when the person hasn't picked one yet). */
export async function getUserPrefs(session: Pick<SessionContext, "userId">): Promise<{ expertMode: boolean; timeZone: string | null }> {
  try {
    return await loadPrefs(session.userId);
  } catch {
    return { expertMode: false, timeZone: null };
  }
}
