// Customer-facing role names: "owner" → "Owner". Database values stay lowercase.
const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE[role] ?? role.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
