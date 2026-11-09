// Schema markup checker (free tool): pure analysis of one page's structured data. No network, no DB.
// Lists every JSON-LD block (with its raw text pretty-printed for display — untrusted, render as text only),
// flags invalid JSON, notes Microdata/RDFa, and checks common types against Google's field lists (schema-rules.ts).
import * as cheerio from "cheerio";
import { collectSchemaTypes } from "@/lib/crawler/extract";
import { ruleForType, type SchemaRule } from "@/lib/tools/schema-rules";
import type { ToolCheck, ToolStatus } from "@/lib/tools/meta-tags";

export const MAX_BLOCKS = 20;
export const MAX_BLOCK_CHARS = 200_000;
/** Longest pretty-printed text we send back per block. */
export const MAX_PRETTY_CHARS = 20_000;
const MAX_NODES = 100;

export interface SchemaBlock {
  index: number;
  valid: boolean;
  /** JSON parse error (invalid blocks only). */
  error: string | null;
  types: string[];
  /** Pretty-printed JSON (or the raw text when invalid), cut to MAX_PRETTY_CHARS. Untrusted: render as text. */
  code: string;
  truncated: boolean;
  /** @context does not mention schema.org. */
  missingContext: boolean;
}

export interface SchemaNodeResult {
  blockIndex: number;
  type: string;
  ruleKey: string;
  label: string;
  docUrl: string;
  /** Display name (name/headline) of the item, if any. */
  name: string | null;
  nested: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  status: ToolStatus;
  note: string | null;
}

export interface SchemaReport {
  blocks: SchemaBlock[];
  /** Blocks we skipped (over MAX_BLOCKS or over MAX_BLOCK_CHARS). */
  skippedBlocks: number;
  types: string[];
  invalidCount: number;
  nodes: SchemaNodeResult[];
  /** Types found that we don't check field by field. */
  uncheckedTypes: string[];
  microdata: { count: number; types: string[] };
  rdfa: { count: number; types: string[] };
  checks: ToolCheck[];
  summary: Record<ToolStatus, number>;
}

const typesOf = (obj: Record<string, unknown>): string[] => {
  const t = obj["@type"];
  const arr = typeof t === "string" ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
  return arr.map((x) => x.replace(/^https?:\/\/schema\.org\//, "").slice(0, 100));
};

const isPresent = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(isPresent);
  return true;
};

/** True when `path` ("offers.price") has a value; arrays match when any element does. */
export function hasField(node: unknown, path: string): boolean {
  const [head, ...rest] = path.split(".");
  if (node === null || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((n) => hasField(n, path));
  const v = (node as Record<string, unknown>)[head];
  if (!rest.length) return isPresent(v);
  if (Array.isArray(v)) return v.some((n) => hasField(n, rest.join(".")));
  return hasField(v, rest.join("."));
}

/** Strip wrappers some CMSs put around JSON-LD (HTML comments, CDATA). */
function unwrap(raw: string): string {
  return raw
    .trim()
    .replace(/^<!--/, "")
    .replace(/-->$/, "")
    .replace(/^\/\/\s*<!\[CDATA\[/, "")
    .replace(/\/\/\s*\]\]>$/, "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function displayName(obj: Record<string, unknown>): string | null {
  for (const k of ["name", "headline"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return null;
}

function checkNode(obj: Record<string, unknown>, type: string, rule: SchemaRule, nested: boolean, blockIndex: number): SchemaNodeResult {
  const missingRequired = rule.required.filter((f) => !hasField(obj, f));
  for (const group of rule.requiredOneOf ?? []) {
    if (!group.some((f) => hasField(obj, f))) missingRequired.push(group.join(" or "));
  }
  if (!nested) for (const f of rule.requiredWhenTopLevel ?? []) if (!hasField(obj, f)) missingRequired.push(f);
  const missingRecommended = rule.recommended.filter((f) => !hasField(obj, f));
  return {
    blockIndex,
    type,
    ruleKey: rule.key,
    label: rule.label,
    docUrl: rule.docUrl,
    name: displayName(obj),
    nested,
    missingRequired,
    missingRecommended,
    status: missingRequired.length ? "fail" : missingRecommended.length ? "warn" : "pass",
    note: rule.note ?? null,
  };
}

/** Walk one parsed JSON-LD block and check every typed node we have a rule for. */
function checkBlock(data: unknown, blockIndex: number, out: SchemaNodeResult[], unchecked: Set<string>): void {
  const walk = (v: unknown, parentTypes: string[], nested: boolean, depth: number) => {
    if (depth > 10 || v === null || typeof v !== "object" || out.length >= MAX_NODES) return;
    if (Array.isArray(v)) {
      for (const item of v.slice(0, 200)) walk(item, parentTypes, nested, depth + 1);
      return;
    }
    const obj = v as Record<string, unknown>;
    const types = typesOf(obj);
    const seen = new Set<string>();
    for (const t of types) {
      const rule = ruleForType(t);
      if (!rule) {
        unchecked.add(t);
        continue;
      }
      if (seen.has(rule.key)) continue;
      if (rule.onlyInside && !parentTypes.some((p) => rule.onlyInside!.includes(p))) continue;
      seen.add(rule.key);
      out.push(checkNode(obj, t, rule, nested, blockIndex));
    }
    for (const [k, val] of Object.entries(obj)) {
      if (k === "@context") continue;
      // Items in @graph are top-level items, not parts of the graph wrapper.
      if (k === "@graph") walk(val, [], false, depth + 1);
      else walk(val, types.length ? types : parentTypes, nested || types.length > 0, depth + 1);
    }
  };
  walk(data, [], false, 0);
}

function mentionsSchemaOrg(data: unknown): boolean {
  const ctxOk = (c: unknown): boolean =>
    typeof c === "string" ? /schema\.org/i.test(c) : Array.isArray(c) ? c.some(ctxOk) : c !== null && typeof c === "object" ? Object.values(c).some(ctxOk) : false;
  if (Array.isArray(data)) return data.length > 0 && data.every((d) => d && typeof d === "object" && ctxOk((d as Record<string, unknown>)["@context"]));
  return !!data && typeof data === "object" && ctxOk((data as Record<string, unknown>)["@context"]);
}

/** Analyse all structured data on one page. */
export function analyzeSchema(html: string): SchemaReport {
  const $ = cheerio.load(html);
  const blocks: SchemaBlock[] = [];
  const nodes: SchemaNodeResult[] = [];
  const unchecked = new Set<string>();
  const parsedAll: unknown[] = [];
  let skippedBlocks = 0;

  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = unwrap($(el).contents().text());
    if (!raw) return;
    if (blocks.length >= MAX_BLOCKS || raw.length > MAX_BLOCK_CHARS) {
      skippedBlocks++;
      return;
    }
    const index = blocks.length + 1;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      blocks.push({ index, valid: false, error: msg.slice(0, 200), types: [], code: raw.slice(0, MAX_PRETTY_CHARS), truncated: raw.length > MAX_PRETTY_CHARS, missingContext: false });
      return;
    }
    parsedAll.push(data);
    const pretty = JSON.stringify(data, null, 2);
    blocks.push({
      index,
      valid: true,
      error: null,
      types: collectSchemaTypes([data]),
      code: pretty.slice(0, MAX_PRETTY_CHARS),
      truncated: pretty.length > MAX_PRETTY_CHARS,
      missingContext: !mentionsSchemaOrg(data),
    });
    checkBlock(data, index, nodes, unchecked);
  });

  const microTypes = new Set<string>();
  const microEls = $("[itemscope]");
  microEls.each((_, el) => {
    for (const t of ($(el).attr("itemtype") ?? "").split(/\s+/).filter(Boolean).slice(0, 3)) microTypes.add(t.replace(/^https?:\/\/schema\.org\//, "").slice(0, 100));
  });
  const rdfaTypes = new Set<string>();
  const rdfaEls = $("[typeof]");
  rdfaEls.each((_, el) => {
    for (const t of ($(el).attr("typeof") ?? "").split(/\s+/).filter(Boolean).slice(0, 3)) rdfaTypes.add(t.replace(/^(https?:\/\/schema\.org\/|schema:)/, "").slice(0, 100));
  });

  const types = collectSchemaTypes(parsedAll);
  const invalidCount = blocks.filter((b) => !b.valid).length;
  const checks: ToolCheck[] = [];
  const add = (c: ToolCheck) => checks.push(c);
  const hasOther = microEls.length > 0 || rdfaEls.length > 0;

  if (blocks.length === 0) {
    add({ id: "jsonld", label: "JSON-LD markup found", status: hasOther ? "warn" : "fail",
      detail: hasOther
        ? "No JSON-LD found, but the page uses Microdata or RDFa (listed below), which Google also reads. We don't check those field by field."
        : "We found no schema markup in this page's HTML.",
      fix: "Add a JSON-LD block describing the page: Organization or LocalBusiness on your home page, Product on product pages, Article on blog posts. Google recommends JSON-LD because it is the easiest format to maintain. If your site adds markup with JavaScript, some tools won't see it." });
  } else {
    add({ id: "jsonld", label: "JSON-LD markup found", status: "pass", detail: `${blocks.length} JSON-LD block${blocks.length === 1 ? "" : "s"} with ${types.length} type${types.length === 1 ? "" : "s"}: ${types.slice(0, 8).join(", ") || "none named"}${types.length > 8 ? "…" : ""}.` });
  }
  if (invalidCount) {
    add({ id: "invalid", label: "JSON is valid", status: "fail", detail: `${invalidCount} block${invalidCount === 1 ? " is" : "s are"} not valid JSON, so search engines ignore ${invalidCount === 1 ? "it" : "them"} completely.`,
      fix: "Look for a missing comma, a trailing comma before } or ], straight quotes replaced by curly quotes, or an unescaped quote inside a value. Paste the block into the Schema Markup Validator to find the exact line." });
  } else if (blocks.length) {
    add({ id: "invalid", label: "JSON is valid", status: "pass", detail: "Every JSON-LD block parses correctly." });
  }
  const noCtx = blocks.filter((b) => b.missingContext).length;
  if (noCtx) {
    add({ id: "context", label: "Uses the schema.org vocabulary", status: "warn", detail: `${noCtx} block${noCtx === 1 ? " has" : "s have"} no "@context": "https://schema.org", so the types may not be understood.`,
      fix: 'Start each block with "@context": "https://schema.org".' });
  }
  const untyped = blocks.filter((b) => b.valid && b.types.length === 0).length;
  if (untyped) {
    add({ id: "untyped", label: "Every block has a @type", status: "warn", detail: `${untyped} block${untyped === 1 ? " has" : "s have"} no @type, so nobody can tell what it describes.`,
      fix: 'Add "@type", for example "@type": "LocalBusiness".' });
  }
  const failing = nodes.filter((n) => n.status === "fail");
  const warning = nodes.filter((n) => n.status === "warn");
  if (nodes.length) {
    if (failing.length) {
      const n = failing[0];
      add({ id: "required", label: "Required fields present", status: "fail",
        detail: `${failing.length} item${failing.length === 1 ? " is" : "s are"} missing fields Google requires, for example ${n.label} is missing ${n.missingRequired.slice(0, 3).join(", ")}.`,
        fix: "Add the missing required fields listed below. Without them the item can't qualify for that rich result." });
    } else {
      add({ id: "required", label: "Required fields present", status: "pass", detail: `All ${nodes.length} checked item${nodes.length === 1 ? " has" : "s have"} the fields Google requires.` });
    }
    if (warning.length) {
      add({ id: "recommended", label: "Recommended fields present", status: "warn",
        detail: `${warning.length} item${warning.length === 1 ? " could" : "s could"} use more detail (recommended fields are missing).`,
        fix: "Fill in the recommended fields that are true for your business, such as telephone, opening hours or images. Only add facts visitors can also see on the page." });
    }
  } else if (blocks.length && !invalidCount) {
    add({ id: "required", label: "Common types checked", status: "warn", detail: "None of the types on this page is one we check field by field (such as Organization, Product, Article or FAQPage).",
      fix: "If this page is about your business, a product, an article, an event or a list of questions, add the matching type." });
  }

  const summary: Record<ToolStatus, number> = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;
  for (const n of nodes) unchecked.delete(n.type);

  return {
    blocks,
    skippedBlocks,
    types,
    invalidCount,
    nodes,
    uncheckedTypes: Array.from(unchecked).filter((t) => !nodes.some((n) => n.type === t)).sort().slice(0, 50),
    microdata: { count: microEls.length, types: Array.from(microTypes).slice(0, 30) },
    rdfa: { count: rdfaEls.length, types: Array.from(rdfaTypes).slice(0, 30) },
    checks,
    summary,
  };
}
