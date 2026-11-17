// Off-site tracker (OffsiteItem): directory listings, review platforms, PR, forums, entity profiles.
// Every query is scoped by organizationId from the session — never from the request body.
import type { OffsiteItem } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import type { SessionContext } from "@/lib/types";
import { getStoredSitePlatform } from "@/lib/platform/server";
import {
  asSource,
  asStatus,
  asType,
  type OffsiteCreateInput,
  type OffsiteFilters,
  type OffsiteItemView,
  type OffsiteStatus,
  type OffsiteUpdateInput,
} from "./types";
import { splitCitations, starterSuggestions, type AiCitationSuggestion, type CompetitorSiteSuggestion, type StarterSuggestion } from "./suggestions";
import { loadAnswerEvidence, suggestionContext } from "./evidence";
import { businessKind, type BusinessKind } from "./starter";

export * from "./types";
export * from "./suggestions";
export * from "./starter";

const MAX_ITEMS = 500;

export function toView(r: OffsiteItem): OffsiteItemView {
  return {
    id: r.id,
    projectId: r.projectId,
    type: asType(r.type),
    name: r.name,
    url: r.url,
    status: asStatus(r.status),
    napConsistent: r.napConsistent,
    source: asSource(r.source),
    taskId: r.taskId,
    notes: r.notes,
    liveAt: r.liveAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** liveAt follows the status: set when an item goes live (unless given), cleared when it leaves "live". */
export function nextLiveAt(prevStatus: OffsiteStatus | null, nextStatus: OffsiteStatus, prevLiveAt: Date | null, explicit?: Date | null, now = new Date()): Date | null {
  if (nextStatus !== "live") return null;
  if (explicit) return explicit;
  if (prevStatus === "live" && prevLiveAt) return prevLiveAt;
  return now;
}

async function assertProject(s: SessionContext, projectId: string) {
  const p = await db.project.findFirst({ where: { id: projectId, organizationId: s.organizationId }, select: { id: true } });
  if (!p) throw new HttpError(404, "not_found", "Project not found");
}

async function loadItem(s: SessionContext, itemId: string, projectId?: string) {
  const row = await db.offsiteItem.findFirst({
    where: { id: itemId, organizationId: s.organizationId, ...(projectId ? { projectId } : {}) },
  });
  if (!row) throw new HttpError(404, "not_found", "Item not found");
  return row;
}

export async function listOffsite(s: SessionContext, projectId: string, f: OffsiteFilters = {}): Promise<OffsiteItemView[]> {
  await assertProject(s, projectId);
  const rows = await db.offsiteItem.findMany({
    where: {
      organizationId: s.organizationId,
      projectId,
      ...(f.status ? { status: f.status } : {}),
      ...(f.type ? { type: f.type } : {}),
      ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { url: { contains: f.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: MAX_ITEMS,
  });
  return rows.map(toView);
}

export async function createOffsite(s: SessionContext, projectId: string, input: OffsiteCreateInput): Promise<OffsiteItemView> {
  await assertProject(s, projectId);
  const count = await db.offsiteItem.count({ where: { organizationId: s.organizationId, projectId } });
  if (count >= MAX_ITEMS) throw new HttpError(409, "limit_reached", `A project can track up to ${MAX_ITEMS} off-site items.`);
  const status = input.status ?? "todo";
  const row = await db.offsiteItem.create({
    data: {
      organizationId: s.organizationId,
      projectId,
      type: input.type,
      name: input.name,
      url: input.url ?? null,
      status,
      napConsistent: input.napConsistent ?? null,
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      liveAt: nextLiveAt(null, status, null, input.liveAt ?? null),
    },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "offsite.create",
    resourceType: "offsite_item",
    resourceId: row.id,
    after: { name: row.name, type: row.type, status: row.status, source: row.source },
  }).catch(() => undefined);
  return toView(row);
}

export async function updateOffsite(s: SessionContext, itemId: string, input: OffsiteUpdateInput, projectId?: string): Promise<OffsiteItemView> {
  const prev = await loadItem(s, itemId, projectId);
  const prevStatus = asStatus(prev.status);
  const status = input.status ?? prevStatus;
  const data = {
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.napConsistent !== undefined ? { napConsistent: input.napConsistent } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    status,
    liveAt: nextLiveAt(prevStatus, status, prev.liveAt, input.liveAt ?? null),
  };
  // Scoped write: updateMany with organizationId so a row from another tenant can never be touched.
  const res = await db.offsiteItem.updateMany({ where: { id: prev.id, organizationId: s.organizationId }, data });
  if (res.count === 0) throw new HttpError(404, "not_found", "Item not found");
  const row = await loadItem(s, prev.id);
  if (prevStatus !== status) {
    await writeAuditLog({
      organizationId: s.organizationId,
      ...auditActorFromSession(s),
      action: "offsite.status",
      resourceType: "offsite_item",
      resourceId: row.id,
      before: { status: prevStatus },
      after: { status },
    }).catch(() => undefined);
  }
  return toView(row);
}

export async function deleteOffsite(s: SessionContext, itemId: string, projectId?: string): Promise<void> {
  const prev = await loadItem(s, itemId, projectId);
  const res = await db.offsiteItem.deleteMany({ where: { id: prev.id, organizationId: s.organizationId } });
  if (res.count === 0) throw new HttpError(404, "not_found", "Item not found");
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "offsite.delete",
    resourceType: "offsite_item",
    resourceId: prev.id,
    before: { name: prev.name, type: prev.type, status: prev.status },
  }).catch(() => undefined);
}

/** Items that went live in [from, to) — for the monthly report's "Off-site work" line. */
export async function listOffsiteForPeriod(projectId: string, organizationId: string, from: Date, to: Date): Promise<OffsiteItemView[]> {
  const rows = await db.offsiteItem.findMany({
    where: { organizationId, projectId, status: "live", liveAt: { gte: from, lt: to } },
    orderBy: { liveAt: "asc" },
    take: MAX_ITEMS,
  });
  return rows.map(toView);
}

export interface OffsiteSuggestions {
  aiCitations: AiCitationSuggestion[];
  /** Businesses AI names or links for this project's questions: competitors, never places to be listed. */
  competitorSites: CompetitorSiteSuggestion[];
  /** When the AI-citation suggestions were measured (latest real, non-simulated check), or null when none yet. */
  measuredAt: string | null;
  starter: StarterSuggestion[];
  /** What kind of business the starter list was chosen for. */
  businessKind: BusinessKind;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** What kind of business a project is, from the facts confirmed in setup and the platform its website is built on. */
export async function projectBusinessKind(
  project: { id: string; organizationId: string; categories?: unknown; keywords?: unknown; audience?: string | null; facts?: unknown },
): Promise<BusinessKind> {
  const facts = project.facts && typeof project.facts === "object" ? (project.facts as { sells?: unknown; customers?: unknown; city?: unknown }) : {};
  const platform = await getStoredSitePlatform(project.organizationId, project.id).catch(() => null);
  return businessKind({
    sells: [typeof facts.sells === "string" ? facts.sells : "", ...strings(project.categories)].join(" "),
    customers: typeof facts.customers === "string" ? facts.customers : project.audience ?? null,
    city: typeof facts.city === "string" ? facts.city : null,
    keywords: strings(project.keywords),
    platform,
  });
}

export async function getOffsiteSuggestions(s: SessionContext, projectId: string): Promise<OffsiteSuggestions> {
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: s.organizationId },
    select: { id: true, organizationId: true, websiteUrl: true, competitors: true, categories: true, keywords: true, audience: true, facts: true },
  });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  const [tracked, evidence, kind] = await Promise.all([
    db.offsiteItem.findMany({ where: { organizationId: s.organizationId, projectId }, select: { url: true, name: true }, take: MAX_ITEMS }),
    loadAnswerEvidence(s.organizationId, projectId),
    projectBusinessKind({ ...project, organizationId: s.organizationId }),
  ]);
  const { places, competitors } = splitCitations(evidence.sources, suggestionContext(project, evidence, tracked));
  return {
    aiCitations: places,
    competitorSites: competitors.slice(0, 8),
    measuredAt: evidence.measuredAt,
    starter: starterSuggestions(tracked, kind),
    businessKind: kind,
  };
}
