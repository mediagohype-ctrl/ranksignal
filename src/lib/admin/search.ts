// Global admin search across organizations, users, projects and leads.
import { db } from "@/lib/db";

export interface SearchHit {
  type: "org" | "user" | "project" | "lead";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function adminSearch(raw: string, perType = 6): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 120);
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const host = q.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  const [orgs, users, projects, leads] = await Promise.all([
    db.organization.findMany({
      where: { OR: [{ id: q }, { name: contains }, { billingCustomerId: q }] },
      take: perType,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, planId: true, status: true },
    }),
    db.user.findMany({
      where: { OR: [{ id: q }, { email: contains }, { name: contains }] },
      take: perType,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, isStaff: true },
    }),
    db.project.findMany({
      where: { OR: [{ id: q }, { name: contains }, { websiteUrl: { contains: host || q, mode: "insensitive" } }] },
      take: perType,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, websiteUrl: true, organizationId: true },
    }),
    db.lead.findMany({
      where: { OR: [{ id: q }, { email: contains }, { name: contains }, { company: contains }, { url: { contains: host || q, mode: "insensitive" } }] },
      take: perType,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, url: true, source: true },
    }),
  ]);
  return [
    ...orgs.map((o) => ({ type: "org" as const, id: o.id, title: o.name, subtitle: `${o.planId} · ${o.status}`, href: `/admin/customers/${o.id}` })),
    ...users.map((u) => ({
      type: "user" as const,
      id: u.id,
      title: u.email,
      subtitle: `${u.name ?? "No name"}${u.isStaff ? " · staff" : ""}`,
      href: `/admin/users/${u.id}`,
    })),
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: p.websiteUrl,
      href: `/admin/customers/${p.organizationId}?tab=projects`,
    })),
    ...leads.map((l) => ({
      type: "lead" as const,
      id: l.id,
      title: l.email ?? l.name ?? l.url ?? "Lead",
      subtitle: `${l.source.replace("_", " ")}${l.url ? ` · ${l.url}` : ""}`,
      href: `/admin/leads/${l.id}`,
    })),
  ];
}
