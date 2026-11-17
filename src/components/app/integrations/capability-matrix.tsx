// What ONE connection can do, in plain words (replaces the old 9 rows × 7 ticks table, which was too technical).
// The lines come straight from the connector's real capability flags, so they stay honest.
import { Check, X } from "lucide-react";
import type { ConnectorCapabilities } from "@/lib/types";

export interface CatalogEntry {
  id: string;
  family: string;
  name: string;
  status: "available" | "planned";
  description: string;
}

export const CAPABILITY_LINES: { key: Exclude<keyof ConnectorCapabilities, "limitations">; label: string }[] = [
  { key: "updateMetadata", label: "Change the headline and summary Google shows for a page" },
  { key: "updateContent", label: "Edit the text on a page" },
  { key: "updateSchema", label: "Add info for Google and AI (for example questions and answers)" },
  { key: "createDraft", label: "Save changes as drafts for you to check first" },
  { key: "publish", label: "Put new pages or posts live" },
  { key: "rollback", label: "Undo a change in one click" },
];

/** Pure: which plain lines a connection can and can't do. */
export function capabilityLines(caps: Partial<ConnectorCapabilities> | null | undefined): { can: string[]; cannot: string[] } {
  const can: string[] = [];
  const cannot: string[] = [];
  for (const line of CAPABILITY_LINES) (caps?.[line.key] ? can : cannot).push(line.label);
  return { can, cannot };
}

export function CapabilityList({ name, caps }: { name: string; caps: Partial<ConnectorCapabilities> | null | undefined }) {
  const { can, cannot } = capabilityLines(caps);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <h4 className="text-small font-semibold text-fg">With {name} connected, we can</h4>
        {can.length === 0 ? (
          <p className="mt-2 text-small text-muted">Nothing yet. Our team makes the changes by hand.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {can.map((l) => (
              <li key={l} className="flex items-start gap-2 text-small text-fg-soft">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
      {cannot.length > 0 && (
        <div>
          <h4 className="text-small font-semibold text-fg">Done by hand on {name}</h4>
          <ul className="mt-2 space-y-1.5">
            {cannot.map((l) => (
              <li key={l} className="flex items-start gap-2 text-small text-muted">
                <X aria-hidden className="mt-0.5 size-4 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
