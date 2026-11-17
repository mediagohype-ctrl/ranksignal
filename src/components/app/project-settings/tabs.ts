// Project Settings tabs (Business · Schedules · Notifications · Team). Plain module (no "use client") so the
// server page and the client form can both use it.

export const SETTINGS_TABS = ["business", "schedules", "notifications", "team"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The tab for a ?tab= value; anything unknown opens Business. */
export function settingsTabFrom(q: string | string[] | null | undefined): SettingsTab {
  const v = (Array.isArray(q) ? q[0] : q)?.trim().toLowerCase();
  if (v === "emails" || v === "alerts") return "notifications";
  if (v === "plan" || v === "members" || v === "you") return "team";
  if (v === "danger" || v === "delete") return "business";
  return (SETTINGS_TABS as readonly string[]).includes(v ?? "") ? (v as SettingsTab) : "business";
}
