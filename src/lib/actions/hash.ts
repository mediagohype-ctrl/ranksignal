// Exact-draft hashing (blueprint §6.2): approvals bind to sha256 of the canonical draft.
import { createHash } from "node:crypto";
import { POLICY_VERSION } from "@/lib/policy/engine";

/** Deterministic JSON: object keys sorted recursively, undefined dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export interface HashableAction {
  type: string;
  target: unknown;
  proposedChange: unknown;
  policyVersion?: string | null;
}

export function draftHash(action: HashableAction): string {
  const payload = canonicalJson({
    type: action.type,
    target: action.target ?? null,
    proposedChange: action.proposedChange ?? null,
    policyVersion: action.policyVersion || POLICY_VERSION,
  });
  return createHash("sha256").update(payload).digest("hex");
}
