// Business Profile monitor: pick a Google Maps place, take snapshots (Places API), and build the page view
// (latest snapshot, checklist, rating/review trend, NAP consistency vs the latest crawl). Tenant-scoped throughout.
import type { BusinessProfile, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { HttpError } from "@/lib/api";
import { getOrgAccess } from "@/lib/billing/access";
import { checklistScore, completenessChecklist, type ChecklistItem } from "./checklist";
import { MANUAL_REFRESH_MIN_HOURS, SEARCHES_PER_HOUR, refreshDaysFor } from "./limits";
import { compareNap, siteNapFromPages, type NapRow, type SiteNap } from "./nap";
import {
  PLACES_MAX_PHOTOS, PLACES_MAX_REVIEWS, PlacesError, getPlaceDetails, isPlacesConfigured, normalizePlace, readSnapshot, searchPlaces,
  type PlaceCandidate, type PlaceSnapshot,
} from "./places";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const FAILURE_BACKOFF_MS = 12 * HOUR;
const MAX_PER_TICK = 20;

// ---- search (rate-limited per organization; in-memory, per instance) ----------------------------------------------

const searchLog = new Map<string, number[]>();

export function allowSearch(organizationId: string, now = Date.now(), limit = SEARCHES_PER_HOUR): boolean {
  const recent = (searchLog.get(organizationId) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= limit) {
    searchLog.set(organizationId, recent);
    return false;
  }
  recent.push(now);
  searchLog.set(organizationId, recent);
  if (searchLog.size > 5000) searchLog.clear();
  return true;
}

export function placesHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof PlacesError) {
    const status = e.kind === "not_found" ? 404 : e.kind === "quota" ? 429 : e.kind === "bad_request" ? 400 : 502;
    return new HttpError(status, `places_${e.kind}`, e.message);
  }
  return new HttpError(502, "places_error", "Couldn't reach Google Maps. Please try again.");
}

export async function searchBusiness(organizationId: string, query: string): Promise<PlaceCandidate[]> {
  if (!allowSearch(organizationId)) {
    throw new HttpError(429, "search_limit", `You can search ${SEARCHES_PER_HOUR} times an hour. Please try again a bit later.`);
  }
  try {
    return await searchPlaces(query);
  } catch (e) {
    throw placesHttpError(e);
  }
}

// ---- snapshots -----------------------------------------------------------------------------------------------------

type Trigger = "schedule" | "manual" | "select";

export async function takeSnapshot(profile: BusinessProfile, trigger: Trigger, now = new Date()): Promise<PlaceSnapshot> {
  try {
    const snap = normalizePlace(await getPlaceDetails(profile.placeId), profile.placeId);
    await db.$transaction([
      db.businessProfileSnapshot.create({
        data: {
          organizationId: profile.organizationId,
          profileId: profile.id,
          placeId: profile.placeId,
          rating: snap.rating,
          reviewCount: snap.reviewCount,
          businessStatus: snap.businessStatus,
          data: snap as unknown as Prisma.InputJsonValue,
          trigger,
          takenAt: now,
        },
      }),
      db.businessProfile.update({
        where: { id: profile.id },
        data: { lastSnapshotAt: now, lastAttemptAt: now, lastError: null, ...(snap.name ? { name: snap.name.slice(0, 300) } : {}), address: snap.address },
      }),
    ]);
    log.info("business_profile.snapshot.ok", { profileId: profile.id, trigger });
    return snap;
  } catch (e) {
    const message = e instanceof PlacesError || e instanceof HttpError ? e.message : "Couldn't reach Google Maps. We'll try again later.";
    log.warn("business_profile.snapshot.failed", { profileId: profile.id, trigger, kind: e instanceof PlacesError ? e.kind : "error" });
    await db.businessProfile
      .update({ where: { id: profile.id }, data: { lastAttemptAt: now, lastError: message.slice(0, 300) } })
      .catch(() => undefined);
    throw e;
  }
}

/** Pure due rule: never snapshotted, or older than the plan's interval; failures back off. */
export function isSnapshotDue(o: { lastSnapshotAt: Date | null; lastAttemptAt: Date | null; lastError: string | null; refreshDays: number; now: Date }): boolean {
  if (o.lastError && o.lastAttemptAt && o.now.getTime() - o.lastAttemptAt.getTime() < FAILURE_BACKOFF_MS) return false;
  if (!o.lastSnapshotAt) return true;
  return o.now.getTime() - o.lastSnapshotAt.getTime() >= o.refreshDays * DAY - HOUR;
}

let ticking = false;

/** Scheduler entry (called from the scheduler tick). Never throws. */
export async function snapshotDueBusinessProfiles(now = new Date()): Promise<{ taken: number; failed: number }> {
  const out = { taken: 0, failed: 0 };
  if (!isPlacesConfigured() || ticking) return out;
  ticking = true;
  try {
    const rows = await db.businessProfile.findMany({
      where: { OR: [{ lastSnapshotAt: null }, { lastSnapshotAt: { lt: new Date(now.getTime() - DAY) } }] },
      orderBy: [{ lastSnapshotAt: { sort: "asc", nulls: "first" } }],
      take: 200,
    });
    const orgs = new Map<string, { planId: string; active: boolean }>();
    let attempted = 0;
    for (const p of rows) {
      if (attempted >= MAX_PER_TICK) break;
      if (!orgs.has(p.organizationId)) {
        const org = await db.organization.findUnique({ where: { id: p.organizationId }, select: { planId: true } });
        const active = await getOrgAccess(p.organizationId, now).then((a) => a.active).catch(() => false);
        orgs.set(p.organizationId, { planId: org?.planId ?? "trial", active });
      }
      const org = orgs.get(p.organizationId)!;
      if (!org.active) continue;
      if (!isSnapshotDue({ ...p, refreshDays: refreshDaysFor(org.planId), now })) continue;
      attempted++;
      try {
        await takeSnapshot(p, "schedule", now);
        out.taken++;
      } catch {
        out.failed++;
      }
    }
  } catch (e) {
    log.error("business_profile.tick_failed", { err: e });
  } finally {
    ticking = false;
  }
  return out;
}

// ---- select / refresh / remove -------------------------------------------------------------------------------------

export async function selectBusiness(o: { organizationId: string; projectId: string; placeId: string; userId: string }) {
  let snap: PlaceSnapshot;
  try {
    snap = normalizePlace(await getPlaceDetails(o.placeId), o.placeId);
  } catch (e) {
    throw placesHttpError(e);
  }
  const existing = await db.businessProfile.findFirst({ where: { organizationId: o.organizationId, projectId: o.projectId } });
  const data = { placeId: o.placeId, name: (snap.name ?? "Your business").slice(0, 300), address: snap.address, createdById: o.userId };
  const profile = existing
    ? await db.businessProfile.update({ where: { id: existing.id }, data: { ...data, lastError: null } })
    : await db.businessProfile.create({ data: { ...data, organizationId: o.organizationId, projectId: o.projectId } });
  const now = new Date();
  await db.$transaction([
    db.businessProfileSnapshot.create({
      data: {
        organizationId: o.organizationId, profileId: profile.id, placeId: o.placeId, rating: snap.rating, reviewCount: snap.reviewCount,
        businessStatus: snap.businessStatus, data: snap as unknown as Prisma.InputJsonValue, trigger: "select", takenAt: now,
      },
    }),
    db.businessProfile.update({ where: { id: profile.id }, data: { lastSnapshotAt: now, lastAttemptAt: now, lastError: null } }),
  ]);
  return profile;
}

export async function refreshBusiness(organizationId: string, projectId: string, now = new Date()) {
  const profile = await db.businessProfile.findFirst({ where: { organizationId, projectId } });
  if (!profile) throw new HttpError(404, "not_found", "Pick your business first.");
  if (profile.lastSnapshotAt && now.getTime() - profile.lastSnapshotAt.getTime() < MANUAL_REFRESH_MIN_HOURS * HOUR) {
    throw new HttpError(429, "refresh_limit", `We refreshed this in the last ${MANUAL_REFRESH_MIN_HOURS} hours. Google Maps rarely changes faster — try again tomorrow.`);
  }
  try {
    await takeSnapshot(profile, "manual", now);
  } catch (e) {
    throw placesHttpError(e);
  }
}

export async function removeBusiness(organizationId: string, projectId: string) {
  const r = await db.businessProfile.deleteMany({ where: { organizationId, projectId } });
  return { removed: r.count > 0 };
}

// ---- page view -----------------------------------------------------------------------------------------------------

export interface BusinessProfileView {
  configured: boolean;
  profile: {
    placeId: string;
    name: string;
    address: string | null;
    lastSnapshotAt: string | null;
    lastError: string | null;
    refreshDays: number;
    nextSnapshotAt: string | null;
    canRefreshAt: string | null;
  } | null;
  latest: (PlaceSnapshot & { takenAt: string }) | null;
  checklist: ChecklistItem[];
  score: { passed: number; total: number } | null;
  trend: { takenAt: string; rating: number | null; reviewCount: number | null }[];
  nap: { rows: NapRow[]; site: SiteNap; crawledAt: string | null } | null;
  limits: { maxReviews: number; maxPhotos: number };
}

async function latestCrawlPages(organizationId: string, projectId: string) {
  const run = await db.crawlRun.findFirst({
    where: { organizationId, projectId, status: "succeeded" },
    orderBy: { createdAt: "desc" },
    select: { id: true, finishedAt: true, createdAt: true },
  });
  if (!run) return null;
  const pages = await db.crawlPage.findMany({
    where: { organizationId, crawlRunId: run.id, statusCode: { gte: 200, lt: 300 } },
    select: { url: true, extracted: true },
    take: 300,
  });
  return { pages, crawledAt: (run.finishedAt ?? run.createdAt).toISOString() };
}

export async function getBusinessProfileView(organizationId: string, projectId: string, websiteUrl: string): Promise<BusinessProfileView> {
  const [profile, org] = await Promise.all([
    db.businessProfile.findFirst({ where: { organizationId, projectId } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } }),
  ]);
  const refreshDays = refreshDaysFor(org?.planId);
  const base: BusinessProfileView = {
    configured: isPlacesConfigured(),
    profile: null,
    latest: null,
    checklist: [],
    score: null,
    trend: [],
    nap: null,
    limits: { maxReviews: PLACES_MAX_REVIEWS, maxPhotos: PLACES_MAX_PHOTOS },
  };
  if (!profile) return base;
  const snaps = await db.businessProfileSnapshot.findMany({
    where: { organizationId, profileId: profile.id },
    orderBy: { takenAt: "desc" },
    take: 104,
    select: { takenAt: true, rating: true, reviewCount: true, data: true },
  });
  const latestRow = snaps[0];
  const latestSnap = latestRow ? readSnapshot(latestRow.data) : null;
  const checklist = latestSnap ? completenessChecklist(latestSnap, { projectWebsite: websiteUrl }) : [];
  let nap: BusinessProfileView["nap"] = null;
  if (latestSnap) {
    const crawl = await latestCrawlPages(organizationId, projectId);
    const site = siteNapFromPages(crawl?.pages ?? []);
    nap = { rows: compareNap(latestSnap, site, websiteUrl), site, crawledAt: crawl?.crawledAt ?? null };
  }
  const last = profile.lastSnapshotAt;
  return {
    ...base,
    profile: {
      placeId: profile.placeId,
      name: profile.name,
      address: profile.address,
      lastSnapshotAt: last?.toISOString() ?? null,
      lastError: profile.lastError,
      refreshDays,
      nextSnapshotAt: last ? new Date(last.getTime() + refreshDays * DAY).toISOString() : null,
      canRefreshAt: last ? new Date(last.getTime() + MANUAL_REFRESH_MIN_HOURS * HOUR).toISOString() : null,
    },
    latest: latestSnap && latestRow ? { ...latestSnap, takenAt: latestRow.takenAt.toISOString() } : null,
    checklist,
    score: checklist.length ? checklistScore(checklist) : null,
    trend: snaps
      .map((s) => ({ takenAt: s.takenAt.toISOString(), rating: s.rating, reviewCount: s.reviewCount }))
      .reverse(),
    nap,
  };
}
