// Settings → API: organization API keys for the public API (/api/v1), the MCP server (/api/mcp) and the Looker
// Studio connector. Everyone can see the list; only owners and admins create or revoke keys.
import { KeyRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppSession, hasRole } from "@/lib/dashboard/server";
import { listApiKeys } from "@/lib/api-keys/service";
import { apiLimitsFor } from "@/lib/api-keys/limits";
import { BRAND } from "@/lib/brand";
import { Card, CardBody, CardHeader, KeyValueList, PageHeader } from "@/components/ui";
import { ApiKeysPanel } from "./api-keys-panel";

export const metadata = { title: "API keys" };
export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const s = await requireAppSession();
  const [org, keys, me] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { name: true, planId: true } }),
    listApiKeys(s.organizationId),
    db.user.findUnique({ where: { id: s.userId }, select: { timeZone: true } }),
  ]);
  const limits = apiLimitsFor(org.planId);
  const base = BRAND.appUrl.replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Read your scores, issues and AI visibility from your own tools: scripts, dashboards, Looker Studio or an AI assistant."
        breadcrumbs={[{ label: "Settings", href: "/app/settings" }, { label: "API keys" }]}
        meta={<span>{org.name}</span>}
      />
      <ApiKeysPanel
        initialKeys={keys}
        canManage={hasRole(s, "admin") && !s.readOnly}
        maxKeys={limits.maxKeys}
        baseUrl={base}
        timeZone={me?.timeZone ?? null}
      />
      <Card>
        <CardHeader icon={<KeyRound />} title="How to use a key" description="Keys can only read data. Nothing on your website can be changed with them." />
        <CardBody>
          <KeyValueList
            items={[
              { label: "REST API", value: <code className="break-all font-mono text-small">{base}/api/v1/projects</code>, hint: "Send Authorization: Bearer mwr_…" },
              { label: "MCP server", value: <code className="break-all font-mono text-small">{base}/api/mcp</code>, hint: "For Claude, Cursor and other AI tools" },
              { label: "Limits", value: `${limits.perMinute} requests a minute per key, ${limits.perDay.toLocaleString("en-IN")} a day for your workspace` },
              { label: "Docs", value: <a className="font-medium text-primary underline-offset-4 hover:underline" href="/docs/api">API, MCP and Looker Studio guide</a> },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
