// AI bot visit analytics: upload + ingest flows on top of the pure parse/aggregate modules.
import { db } from "@/lib/db";
import { BotAggregator } from "./aggregate";
import { TRACKED_BOTS, type RangeSource } from "./bots";
import { parseLogLine, type LogHit } from "./parse";
import { loadRangeChecker } from "./ranges";
import { aiBotLimitsFor } from "./limits";
import { persistAggregates, uploadsToday } from "./store";
import { readLogLines, type StreamStats } from "./stream";

export { DuplicateImportError } from "./store";
export { UploadLimitError } from "./stream";

export class AiBotLimitError extends Error {}

const ALL_SOURCES = [...new Set(TRACKED_BOTS.map((b) => b.ranges).filter((r): r is RangeSource => !!r))];

export async function planIdForOrg(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return org?.planId ?? "trial";
}

export interface UploadResult {
  importId: string | null;
  linesTotal: number;
  linesParsed: number;
  botHits: number;
  firstDate: string | null;
  lastDate: string | null;
  bytes: number;
  verifiedAgainst: RangeSource[];
}

/** Stream-parse an uploaded log and merge its crawler hits. Raw lines are never stored. */
export async function importLogUpload(o: {
  organizationId: string;
  projectId: string;
  userId: string;
  fileName: string | null;
  body: AsyncIterable<Uint8Array>;
}): Promise<UploadResult> {
  const scope = { organizationId: o.organizationId, projectId: o.projectId };
  const limits = aiBotLimitsFor(await planIdForOrg(o.organizationId));
  if ((await uploadsToday(scope)) >= limits.uploadsPerDay) {
    throw new AiBotLimitError(`Your plan allows ${limits.uploadsPerDay} log uploads a day for each website. Try again tomorrow.`);
  }
  const checker = await loadRangeChecker(ALL_SOURCES);
  const agg = new BotAggregator(checker);
  const stats: StreamStats = { bytes: 0, sha256: "", gzip: false };
  for await (const line of readLogLines(o.body, stats)) {
    agg.countLine();
    const hit = parseLogLine(line);
    if (hit) agg.add(hit);
  }
  const importId = await persistAggregates(
    scope, agg,
    { source: "upload", fileName: o.fileName, sha256: stats.sha256, bytes: stats.bytes, createdById: o.userId },
    { historyDays: limits.historyDays },
  );
  const s = agg.summary();
  return { importId, ...s, bytes: stats.bytes, verifiedAgainst: checker.loaded() };
}

/** Merge a batch from the ingest endpoint. */
export async function ingestHits(o: { organizationId: string; projectId: string; hits: LogHit[]; historyDays: number }): Promise<{ botHits: number }> {
  const agg = new BotAggregator(await loadRangeChecker(ALL_SOURCES));
  for (const h of o.hits) {
    agg.countLine();
    agg.add(h);
  }
  if (agg.botHits > 0) {
    await persistAggregates({ organizationId: o.organizationId, projectId: o.projectId }, agg, { source: "ingest" }, { historyDays: o.historyDays });
  }
  return { botHits: agg.botHits };
}
