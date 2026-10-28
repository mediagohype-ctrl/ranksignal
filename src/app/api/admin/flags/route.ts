import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/staff";
import { FLAG_DEFAULTS, isEnabled, setFlag } from "@/lib/flags";
import { writeAuditLog } from "@/lib/audit-log";

const FLAG_KEY_RE = /^(global\.publishing|provider\.[a-z0-9_-]{1,40}|action\.[a-z0-9_]{1,60})$/;

export const GET = handler(async () => {
  await requireStaff();
  const stored = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
  const keys = new Set([...Object.keys(FLAG_DEFAULTS), ...stored.map((f) => f.key)]);
  const items = await Promise.all(
    [...keys].sort().map(async (key) => {
      const row = stored.find((f) => f.key === key);
      return { key, enabled: await isEnabled(key), isDefault: !row, note: row?.note ?? null, updatedAt: row?.updatedAt ?? null };
    }),
  );
  return json({ items });
});

const schema = z.object({
  key: z.string().regex(FLAG_KEY_RE, "Allowed keys: global.publishing, provider.<id>, action.<type>"),
  enabled: z.boolean(),
  note: z.string().max(500).optional(),
});

export const POST = handler(async (req: Request) => {
  const { user } = await requireStaff();
  const input = await parseBody(req, schema);
  const before = await isEnabled(input.key);
  const flag = await setFlag(input.key, input.enabled, input.note);
  await writeAuditLog({
    organizationId: null,
    actorId: user.id,
    actorType: "staff",
    action: "admin.flag_changed",
    resourceType: "feature_flag",
    resourceId: input.key,
    before: { enabled: before },
    after: { enabled: input.enabled, note: input.note ?? null },
  });
  return json({ item: flag });
});
