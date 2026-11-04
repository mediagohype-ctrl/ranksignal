// Customer-facing role names (brief 5.8): Owner / Can approve / View only. Database values stay owner/admin/member/viewer.
// Admin and Member both read "Can approve" — admins can also manage the team and plan, which the screens explain.
const ROLE: Record<string, string> = { owner: "Owner", admin: "Can approve", member: "Can approve", viewer: "View only" };

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE[role] ?? role.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
