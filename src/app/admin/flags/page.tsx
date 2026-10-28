// Feature flags & kill switches.
import { Flag } from "lucide-react";
import { db } from "@/lib/db";
import { FLAG_DEFAULTS, isEnabled } from "@/lib/flags";
import { requireStaffPage } from "@/lib/admin/guard";
import { fmtDateTime } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, Notice, PageHeader } from "@/components/ui";
import { FlagToggles } from "@/components/admin/flags";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  await requireStaffPage();
  const stored = await db.featureFlag.findMany();
  const keys = [...new Set([...Object.keys(FLAG_DEFAULTS), ...stored.map((f) => f.key)])].sort((a, b) =>
    a === "global.publishing" ? -1 : b === "global.publishing" ? 1 : a.localeCompare(b),
  );
  const flags = await Promise.all(
    keys.map(async (key) => {
      const row = stored.find((f) => f.key === key);
      return { key, enabled: await isEnabled(key), isDefault: !row, note: row?.note ?? null, updatedAt: row ? fmtDateTime(row.updatedAt) : null };
    }),
  );
  const globalOn = flags.find((f) => f.key === "global.publishing")?.enabled ?? true;
  const groups = [
    { id: "global", title: "Global", description: "Platform-wide kill switches.", items: flags.filter((f) => f.key.startsWith("global.")) },
    { id: "provider", title: "AI providers", description: "Turn individual answer providers on or off.", items: flags.filter((f) => f.key.startsWith("provider.")) },
    { id: "action", title: "Action types", description: "Per-action-type publishing switches (absent = enabled).", items: flags.filter((f) => f.key.startsWith("action.")) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Feature flags"
        description="Changes apply immediately and are written to the audit log."
        meta={
          <Badge tone={globalOn ? "success" : "danger"} variant="dot">
            Global publishing {globalOn ? "on" : "off"}
          </Badge>
        }
      />
      {!globalOn && (
        <Notice tone="danger" title="Publishing is stopped for every customer">
          No connector can publish changes until global.publishing is turned back on.
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader icon={<Flag />} title={g.title} description={g.description} />
            <CardBody>
              <FlagToggles initial={g.items} allowAdd={g.id === "action" || g.id === "provider"} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
