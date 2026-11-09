// Staff roles & permissions for the admin back-office (pure, no DB — tested).
// A staff member (User.isStaff) holds one or more roles (User.staffRoles); their permissions are the union.
// Every admin page and API checks ONE permission. Add a new admin section = add a permission + nav entry here.

export const PERMISSIONS = {
  "overview.view": "See the business overview (signups, MRR, AI spend, failures)",
  "customers.view": "See customer workspaces, projects and members",
  "customers.manage": "Change a customer's plan, status, trial, publishing; write notes",
  "customers.enter": "Enter a customer's workspace in support mode",
  "users.view": "See user accounts",
  "users.manage": "Send password-reset and verification emails",
  "leads.view": "See inbound leads",
  "leads.manage": "Update lead status, notes and follow-ups",
  "leads.export": "Export leads as CSV",
  "revenue.view": "See revenue, plans, subscriptions and billing webhooks",
  "ai.view": "See AI usage and costs",
  "jobs.view": "See background jobs",
  "jobs.manage": "Retry or cancel background jobs",
  "reports.view": "See monthly client reports",
  "reports.manage": "Generate, edit, approve and regenerate monthly reports",
  "audit.view": "See the audit log",
  "webhooks.view": "See webhook deliveries",
  "flags.view": "See feature flags",
  "flags.manage": "Turn feature flags on or off",
  "system.view": "See system health and configuration",
  "seo.view": "See the SEO command centre (our site + customer SEO health)",
  "seo.manage": "Run self-checks and submit URLs to search engines (IndexNow)",
  "team.manage": "Add staff, assign roles and remove staff access",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
const VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(".view"));

export interface StaffRoleDef {
  label: string;
  description: string;
  permissions: readonly Permission[];
}

export const STAFF_ROLES = {
  super_admin: {
    label: "Super admin",
    description: "Everything, including managing the team. Keep this to founders.",
    permissions: ALL_PERMISSIONS,
  },
  seo: {
    label: "SEO team",
    description: "SEO command centre, customer SEO health, monthly reports and job status.",
    permissions: ["seo.view", "seo.manage", "customers.view", "reports.view", "reports.manage", "jobs.view"],
  },
  marketing: {
    label: "Marketing",
    description: "Leads from the website and free tools, our own SEO and the guides.",
    permissions: ["seo.view", "seo.manage", "leads.view", "leads.manage", "leads.export", "customers.view"],
  },
  sales: {
    label: "Sales",
    description: "Leads pipeline, customer accounts and plan mix.",
    permissions: ["leads.view", "leads.manage", "leads.export", "customers.view", "revenue.view"],
  },
  finance: {
    label: "Finance",
    description: "Revenue, subscriptions, AI costs and the audit trail. Read-only on customers.",
    permissions: ["overview.view", "revenue.view", "ai.view", "customers.view", "audit.view", "webhooks.view"],
  },
  operations: {
    label: "Operations",
    description: "Run the service: customers, jobs, monthly reports, users and webhooks.",
    permissions: [
      "overview.view",
      "customers.view",
      "customers.manage",
      "customers.enter",
      "users.view",
      "users.manage",
      "jobs.view",
      "jobs.manage",
      "reports.view",
      "reports.manage",
      "webhooks.view",
      "seo.view",
    ],
  },
  support: {
    label: "Customer support",
    description: "Help customers: look up accounts, enter workspaces, send account emails.",
    permissions: ["customers.view", "customers.enter", "users.view", "users.manage", "leads.view", "jobs.view", "reports.view"],
  },
  engineering: {
    label: "Engineering",
    description: "Jobs, webhooks, feature flags, system health, AI costs and audit log.",
    permissions: ["overview.view", "jobs.view", "jobs.manage", "webhooks.view", "flags.view", "flags.manage", "system.view", "ai.view", "audit.view"],
  },
  viewer: {
    label: "Read-only (all sections)",
    description: "Can look at every section but cannot change anything. Good for investors and auditors.",
    permissions: VIEW_PERMISSIONS,
  },
} as const satisfies Record<string, StaffRoleDef>;

export type StaffRole = keyof typeof STAFF_ROLES;
export const STAFF_ROLE_IDS = Object.keys(STAFF_ROLES) as StaffRole[];

export function isStaffRole(r: string): r is StaffRole {
  return Object.prototype.hasOwnProperty.call(STAFF_ROLES, r);
}

/** Keeps known roles only, de-duplicated, in catalogue order. */
export function normalizeRoles(roles: readonly string[] | null | undefined): StaffRole[] {
  const set = new Set((roles ?? []).filter(isStaffRole));
  return STAFF_ROLE_IDS.filter((r) => set.has(r));
}

export function permissionsFor(roles: readonly string[] | null | undefined): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of normalizeRoles(roles)) for (const p of STAFF_ROLES[r].permissions) out.add(p);
  return out;
}

export function roleLabels(roles: readonly string[] | null | undefined): string[] {
  return normalizeRoles(roles).map((r) => STAFF_ROLES[r].label);
}

/** Admin navigation; each entry is shown only to staff holding its permission. */
export const ADMIN_SECTIONS: { href: string; label: string; permission: Permission; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", permission: "overview.view", exact: true },
  { href: "/admin/seo", label: "SEO command centre", permission: "seo.view" },
  { href: "/admin/customers", label: "Customers", permission: "customers.view" },
  { href: "/admin/users", label: "Users", permission: "users.view" },
  { href: "/admin/leads", label: "Leads", permission: "leads.view" },
  { href: "/admin/revenue", label: "Revenue & plans", permission: "revenue.view" },
  { href: "/admin/ai", label: "AI usage & costs", permission: "ai.view" },
  { href: "/admin/jobs", label: "Jobs", permission: "jobs.view" },
  { href: "/admin/monthly-reports", label: "Monthly reports", permission: "reports.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/webhooks", label: "Webhooks", permission: "webhooks.view" },
  { href: "/admin/flags", label: "Feature flags", permission: "flags.view" },
  { href: "/admin/system", label: "System", permission: "system.view" },
  { href: "/admin/team", label: "Team & roles", permission: "team.manage" },
];

/** Where to land a staff member: the first section they may open (null = no sections at all). */
export function firstAllowedPath(perms: ReadonlySet<Permission>): string | null {
  return ADMIN_SECTIONS.find((s) => perms.has(s.permission))?.href ?? null;
}
