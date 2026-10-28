// Lead list filters shared by the Leads page and the CSV export route.
import type { Prisma } from "@prisma/client";
import { LEAD_SOURCES, LEAD_STATUSES } from "./leads";
import { dateRangeWhere, str, type SearchParams } from "./params";

export function leadWhere(sp: SearchParams): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const source = str(sp, "source");
  if ((LEAD_SOURCES as readonly string[]).includes(source)) where.source = source;
  const status = str(sp, "status");
  if ((LEAD_STATUSES as readonly string[]).includes(status)) where.status = status;
  const createdAt = dateRangeWhere(sp);
  if (createdAt) where.createdAt = createdAt;
  const q = str(sp, "q").slice(0, 120);
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    where.OR = [{ email: c }, { name: c }, { company: c }, { url: c }, { message: c }];
  }
  return where;
}

export function searchParamsFromUrl(url: string): SearchParams {
  return Object.fromEntries(new URL(url).searchParams.entries());
}
