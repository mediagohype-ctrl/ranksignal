// Feature flags / kill switches (blueprint §5 Admin, §11). Missing flag = default value.
import { db } from "@/lib/db";

export const FLAG_DEFAULTS: Record<string, boolean> = {
  "global.publishing": true, // global kill switch for every connector write
  "provider.openai": true,
  "provider.gemini": true,
  "provider.perplexity": true,
  "provider.dataforseo": true,
  "provider.simulated": true,
};

export async function isEnabled(key: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (flag) return flag.enabled;
  // Per-action-type flags are kill switches: absent means enabled.
  return FLAG_DEFAULTS[key] ?? key.startsWith("action.");
}

export async function setFlag(key: string, enabled: boolean, note?: string) {
  return db.featureFlag.upsert({ where: { key }, create: { key, enabled, note }, update: { enabled, note } });
}
