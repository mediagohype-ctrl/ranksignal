// Shared contracts. Every module builds against these — change only with coordination.
import { z } from "zod";

// ---------- Workflow (blueprint §2.3) ----------
export const WORKFLOW_STATES = [
  "queued", "preflight", "running", "awaiting_approval", "approved", "executing",
  "validating", "succeeded", "succeeded_with_warnings", "rejected", "blocked",
  "retry_scheduled", "failed", "rollback_pending", "rolled_back", "rollback_failed", "cancelled",
] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];
export type WorkflowKind = "crawl" | "visibility" | "analyze" | "execute_action" | "rollback";
export type ErrorClass = "transient" | "permanent" | "policy" | "quota";

/** Thrown by job handlers to classify failures; transient errors are retried with backoff. */
export class JobError extends Error {
  constructor(message: string, public errorClass: ErrorClass = "permanent") {
    super(message);
  }
}

// ---------- Tenancy / auth ----------
export type Role = "owner" | "admin" | "member" | "viewer";
export interface SessionContext {
  userId: string;
  email: string;
  organizationId: string;
  role: Role;
  /** Staff member working inside a customer workspace ("support mode"); see src/lib/auth/access.ts. */
  staffMode?: boolean;
}

// ---------- Plans (blueprint §10) ----------
export type PlanId = "trial" | "starter" | "growth" | "agency";
export interface PlanLimits {
  id: PlanId;
  name: string;
  priceInrMonthly: number | null;
  maxProjects: number;
  maxTrackedPrompts: number;
  maxPagesPerCrawl: number;
  monthlyCredits: number;
  minScanIntervalDays: number;
  seats: number;
  competitorTracking: boolean;
  approvalPublishing: boolean;
}

// ---------- Audit ----------
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory =
  | "technical" | "content" | "metadata" | "schema" | "indexability" | "links" | "ai_readiness";

export interface ExtractedPage {
  title: string | null;
  description: string | null;
  h1: string[];
  headings: { level: number; text: string }[];
  canonical: string | null;
  robotsMeta: string | null;
  lang: string | null;
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt: string | null }[];
  jsonLd: unknown[];
  schemaTypes: string[];
  wordCount: number;
  textSample: string; // first ~2k chars of visible text (untrusted)
  hasFaq: boolean;
  contentFingerprint: string;
  // ---- Optional richer signals (report engine, extractor v2). Absent on pages crawled before v2. ----
  extractorVersion?: number;
  /** h2/h3 headings phrased as questions. */
  questionHeadings?: string[];
  /** Question headings followed by a concise (≈25–90 word) answer paragraph. */
  questionsWithConciseAnswer?: number;
  listCount?: number;
  tableCount?: number;
  /** Words in paragraph/list body copy (excludes nav/footer chrome where detectable). */
  contentWordCount?: number;
  sentenceCount?: number;
  /** Flesch reading ease (English only; null for other languages / too little text). */
  readingEase?: number | null;
  /** Sentences containing numbers, percentages or amounts ("quotable facts"). */
  statSentenceCount?: number;
  statExamples?: string[];
  datePublished?: string | null;
  dateModified?: string | null;
  author?: string | null;
  /** Where author signals were found: meta | jsonld | rel_author | byline. */
  authorSignals?: string[];
  organization?: {
    types: string[];
    name: string | null;
    url: string | null;
    logo: string | null;
    sameAs: string[];
    hasContactPoint: boolean;
    hasAddress: boolean;
    telephone: string | null;
    email: string | null;
  } | null;
  openGraph?: { title: string | null; description: string | null; image: string | null; type: string | null; siteName: string | null };
  twitter?: { card: string | null; title: string | null; image: string | null };
  /** Internal links that look like key trust pages. */
  pageLinks?: { about: string | null; contact: string | null; privacy: string | null; terms: string | null };
  /** Links inside <nav>/<header> (internal, normalised). */
  navLinks?: string[];
  socialLinks?: string[];
  /** Outbound links to authoritative sources (.gov/.edu/Wikipedia/standards/research...). */
  citationLinks?: string[];
  hasPhoneLink?: boolean;
  hasEmailLink?: boolean;
  viewport?: string | null;
  /** <script src> in <head> without async/defer/module — page-speed proxy only. */
  renderBlockingScripts?: number;
  stylesheetCount?: number;
  /** Case-insensitive brand name occurrences (only when brand names were supplied). */
  brandMentions?: { inTitle: boolean; inH1: boolean; bodyCount: number };
}

export interface FindingInput {
  category: FindingCategory;
  code: string;
  severity: Severity;
  confidence: number;
  message: string;
  pageUrl?: string;
  evidence: Record<string, unknown>;
}

// ---------- Visibility (blueprint §9) ----------
export interface Citation {
  url: string;
  domain: string;
  title?: string;
  ownedByCustomer: boolean;
}

export interface VisibilityQuery {
  promptId: string;
  text: string;
  locale: string;
}

export interface ProviderAnswer {
  provider: string;
  platformLabel: string;
  model?: string;
  answerText: string;
  citations: { url: string; title?: string }[];
  rawPayloadRef?: string;
  costMicros: number;
  simulated: boolean;
  limitations?: string;
}

export interface VisibilityProvider {
  id: string;
  label: string;
  /** true when the provider fabricates demo data; UI must label it. */
  simulated: boolean;
  isConfigured(): boolean;
  run(query: VisibilityQuery): Promise<ProviderAnswer>;
}

export interface VisibilityMetrics {
  sampleSize: number;
  collected: number;
  mentionRate: number;
  citationRate: number;
  recommendationRate: number;
  competitorShare: Record<string, number>; // name -> share of all brand+competitor mentions
  citationSources: { domain: string; count: number; owned: boolean }[];
  byProvider: Record<string, { collected: number; mentionRate: number; citationRate: number }>;
  visibilityIndex: number; // 0-100 composite; formula versioned in metrics.ts
  formulaVersion: string;
  window: { from: string; to: string };
  simulated: boolean;
}

// ---------- Actions / policy (blueprint §6) ----------
export type RiskClass = "A" | "B" | "C" | "D";
export type PolicyDecision = "auto_execute" | "approval_required" | "blocked";
export type ActionStatus =
  | "proposed" | "awaiting_approval" | "approved" | "rejected" | "expired" | "executing"
  | "succeeded" | "succeeded_with_warnings" | "failed" | "rollback_pending" | "rolled_back"
  | "rollback_failed" | "blocked" | "cancelled" | "completed_manually";

export interface ProposedChange {
  field: string;
  before: string | null;
  after: string;
}

export interface ActionTarget {
  resourceType: string;
  resourceId?: string;
  url?: string;
}

// ---------- Connectors (blueprint §3.3) ----------
export interface ConnectorCapabilities {
  readPages: boolean;
  createDraft: boolean;
  updateContent: boolean;
  updateMetadata: boolean;
  updateSchema: boolean;
  preview: boolean;
  publish: boolean;
  revisionHistory: boolean;
  rollback: boolean;
  delete: boolean;
  resourceTypes: string[];
  limitations: string[];
}

export interface ConnectorResource {
  id: string;
  type: string;
  url: string;
  title?: string;
  version?: string; // ETag / modified timestamp
  fields: Record<string, string | null>;
}

export interface PatchResult {
  ok: boolean;
  newVersion?: string;
  detail?: Record<string, unknown>;
  error?: string;
}

export interface Connector {
  id: string; // wordpress | manual | github ...
  getCapabilities(): ConnectorCapabilities;
  testConnection(): Promise<{ ok: boolean; identity?: string; error?: string }>;
  listResources(cursor?: string): Promise<{ items: ConnectorResource[]; nextCursor?: string }>;
  getResource(id: string): Promise<ConnectorResource | null>;
  createDraft(resourceType: string, content: Record<string, string>): Promise<PatchResult>;
  proposePatch(resourceId: string, change: ProposedChange): Promise<{ preview: string; diff: string }>;
  applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult>;
  validateResource(resourceId: string, change: ProposedChange): Promise<{ status: "passed" | "warning" | "failed"; detail: string }>;
  rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult>;
  disconnect(): Promise<void>;
}

// ---------- API helpers ----------
export const projectInputSchema = z.object({
  name: z.string().min(1).max(120),
  websiteUrl: z.string().url(),
  brandNames: z.array(z.string().min(1)).min(1).max(20),
  categories: z.array(z.string()).max(20).default([]),
  audience: z.string().max(500).optional(),
  countries: z.array(z.string().length(2)).max(20).default(["IN"]),
  languages: z.array(z.string().min(2).max(5)).max(10).default(["en"]),
  competitors: z
    .array(z.object({ name: z.string().min(1), domain: z.string().optional(), aliases: z.array(z.string()).default([]) }))
    .max(20)
    .default([]),
  keywords: z.array(z.string()).max(100).default([]),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
