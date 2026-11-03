import { Check, X } from "lucide-react";
import type { ConnectorCapabilities } from "@/lib/types";
import { Badge, Table, TD, TH, THead, TR } from "@/components/ui";

export interface CatalogEntry {
  id: string;
  family: string;
  name: string;
  status: "available" | "planned";
  description: string;
}

export const CAP_COLUMNS: { key: keyof ConnectorCapabilities; label: string; help: string }[] = [
  { key: "readPages", label: "Read pages", help: "Look up your pages and posts" },
  { key: "updateMetadata", label: "Google headline & summary", help: "Change the headline and summary Google shows for a page" },
  { key: "updateContent", label: "Page text", help: "Edit the main content of a page" },
  { key: "updateSchema", label: "Info for Google and AI", help: "Add hidden info that helps Google and AI tools (e.g. questions and answers)" },
  { key: "createDraft", label: "Drafts", help: "Save changes as drafts for you to check" },
  { key: "publish", label: "Publish", help: "Make changes live" },
  { key: "rollback", label: "Undo", help: "Restore the previous version" },
];

function Cap({ v, label, name }: { v: boolean; label: string; name: string }) {
  return v ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
      <Check aria-hidden className="size-3.5" />
      <span className="sr-only">{name} can: {label}</span>
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-muted">
      <X aria-hidden className="size-3.5" />
      <span className="sr-only">{name} cannot: {label}</span>
    </span>
  );
}

/** Which connector can do what. Planned connectors have no confirmed capabilities yet. */
export function CapabilityMatrix({ catalog, capabilityMap }: { catalog: CatalogEntry[]; capabilityMap: Record<string, ConnectorCapabilities> }) {
  return (
    <div>
      <Table caption="What each connection can do" stickyHeader zebra>
        <THead>
          <tr>
            <TH>Connection</TH>
            {CAP_COLUMNS.map((c) => (
              <TH key={c.key} align="center">
                <abbr title={c.help} className="no-underline">
                  {c.label}
                </abbr>
              </TH>
            ))}
          </tr>
        </THead>
        <tbody>
          {catalog.map((c) => {
            const caps = capabilityMap[c.id];
            return (
              <TR key={c.id}>
                <TD className="min-w-44">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {c.name}
                    {c.status === "planned" ? <Badge>Planned</Badge> : <Badge tone="success">Available</Badge>}
                  </div>
                  <div className="text-caption font-normal text-muted">{c.family}</div>
                </TD>
                {CAP_COLUMNS.map((col) => (
                  <TD key={col.key} align="center">
                    {caps ? (
                      <Cap v={Boolean(caps[col.key])} label={col.label} name={c.name} />
                    ) : (
                      <span className="text-caption text-muted">
                        <span aria-hidden>—</span>
                        <span className="sr-only">Not yet known</span>
                      </span>
                    )}
                  </TD>
                ))}
              </TR>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
