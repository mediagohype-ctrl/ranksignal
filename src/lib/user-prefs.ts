// The signed-in person's own preferences (User.expertMode, User.timeZone). Pure: safe for client, server and tests.
import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/dashboard/format";

export { DEFAULT_TIME_ZONE, isValidTimeZone };

/** All zones the runtime knows (for the Time zone select), with a small fallback. */
export function timeZoneOptions(): string[] {
  try {
    const list = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    /* fall through */
  }
  return ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "UTC"];
}

/** PATCH /api/me body. Time zones must be real IANA names (checked with Intl.DateTimeFormat). */
export const mePatchSchema = z
  .object({
    expertMode: z.boolean().optional(),
    timeZone: z.string().trim().max(64).refine(isValidTimeZone, "Pick a time zone from the list").optional(),
  })
  .strict()
  .refine((v) => v.expertMode !== undefined || v.timeZone !== undefined, "Nothing to change");
export type MePatch = z.infer<typeof mePatchSchema>;
