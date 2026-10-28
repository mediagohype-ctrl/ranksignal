// Manual / export-only connector (blueprint §3.2 fallback). It can never write to a site, so every
// write returns { ok: false, error: "manual_required" } with copy-ready instructions — never a
// silent no-op success.
import type {
  ActionTarget, Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

export const MANUAL_CAPABILITIES: ConnectorCapabilities = {
  readPages: false,
  createDraft: false,
  updateContent: false,
  updateMetadata: false,
  updateSchema: false,
  preview: true,
  publish: false,
  revisionHistory: false,
  rollback: false,
  delete: false,
  resourceTypes: [],
  limitations: [
    "Export only: changes must be applied by a person in the CMS or codebase.",
    "The platform cannot verify or roll back manual changes; re-run a crawl to measure.",
  ],
};

const FIELD_LABEL: Record<string, string> = {
  meta_description: "Meta description (<meta name=\"description\">)",
  title: "Page title (<title> / SEO title)",
  excerpt: "Excerpt",
  content: "Page content",
  schema: "Structured data (JSON-LD <script type=\"application/ld+json\">)",
  brief: "Content brief",
  robots: "robots.txt",
};

export function buildManualInstructions(a: {
  type: string;
  target?: ActionTarget | null;
  proposedChange?: ProposedChange | null;
  rationale?: string;
}): string {
  const c = a.proposedChange;
  const lines = [
    `Manual change required — ${a.type.replace(/_/g, " ")}`,
    a.target?.url ? `Page: ${a.target.url}` : a.target?.resourceId ? `Resource: ${a.target.resourceId}` : "",
    c ? `Field: ${FIELD_LABEL[c.field] ?? c.field}` : "",
    c?.before != null ? `Current value:\n${c.before}` : c ? "Current value: (empty)" : "",
    c ? `New value (copy exactly):\n${c.after}` : "",
    a.rationale ? `Why: ${a.rationale}` : "",
    "After applying, re-run a crawl so the change can be validated and re-measured.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export function createManualConnector(context?: { type: string; target?: ActionTarget | null; rationale?: string }): Connector {
  const manual = (change?: ProposedChange): PatchResult => ({
    ok: false,
    error: "manual_required",
    detail: {
      instructions: buildManualInstructions({
        type: context?.type ?? "change",
        target: context?.target ?? null,
        proposedChange: change ?? null,
        rationale: context?.rationale,
      }),
    },
  });
  return {
    id: "manual",
    getCapabilities: () => MANUAL_CAPABILITIES,
    async testConnection() {
      return { ok: true, identity: "manual export" };
    },
    async listResources() {
      return { items: [] };
    },
    async getResource(): Promise<ConnectorResource | null> {
      return null;
    },
    async createDraft() {
      return manual();
    },
    async proposePatch(_resourceId, change) {
      return { preview: change.after, diff: simpleDiff(change.before, change.after) };
    },
    async applyPatch(_resourceId, change) {
      return manual(change);
    },
    async validateResource() {
      return { status: "failed", detail: "Manual connector cannot verify changes automatically; re-crawl to validate." };
    },
    async rollback() {
      return manual();
    },
    async disconnect() {},
  };
}

export function simpleDiff(before: string | null | undefined, after: string): string {
  const b = (before ?? "").split("\n");
  const a = after.split("\n");
  const out: string[] = [];
  for (const l of b) if (!a.includes(l)) out.push(`- ${l}`);
  for (const l of a) if (!b.includes(l)) out.push(`+ ${l}`);
  return out.join("\n");
}
