"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CreditCard, Palette, UserRound, Users } from "lucide-react";
import { TabPanel, Tabs } from "@/components/ui";

const IDS = ["workspace", "members", "billing", "branding", "account"] as const;
type TabId = (typeof IDS)[number];

/** ?tab= values people type or old links use → the real tab key ("Team" is the tab's label; its key is "members"). */
const TAB_ALIASES: Record<string, TabId> = { team: "members", usage: "billing", plans: "billing", profile: "account" };

/** The tab for a ?tab= value (null when unknown). */
export function tabFromQuery(q: string | null | undefined): TabId | null {
  if (!q) return null;
  const v = q.trim().toLowerCase();
  if (IDS.includes(v as TabId)) return v as TabId;
  return TAB_ALIASES[v] ?? null;
}

function fromHash(hash: string): TabId | null {
  const h = hash.replace("#", "");
  // "#plans" is the anchor of the plan cards on the Billing tab (every "Upgrade" button links to it).
  if (h === "billing" || h === "usage" || h === "plans") return "billing";
  if (h === "members") return "members";
  if (h === "workspace") return "workspace";
  if (h === "branding" || h === "white-label") return "branding";
  if (h === "account" || h === "profile") return "account";
  return null;
}

export function SettingsTabs({
  workspace,
  members,
  billing,
  branding,
  account,
  memberCount,
}: {
  workspace: React.ReactNode;
  members: React.ReactNode;
  billing: React.ReactNode;
  branding?: React.ReactNode;
  account?: React.ReactNode;
  memberCount?: number;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("tab");
  const initial: TabId = tabFromQuery(q) ?? "workspace";
  const [tab, setTab] = useState<TabId>(initial);

  useEffect(() => {
    const h = fromHash(window.location.hash);
    if (h) setTab(h);
  }, []);
  useEffect(() => {
    const t = tabFromQuery(q);
    if (t) setTab(t);
  }, [q]);
  // Links like /app/settings?tab=billing#plans ("Upgrade" buttons): once that tab is on screen, scroll to the section.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(timer);
  }, [tab, q]);

  function change(id: string) {
    const t = id as TabId;
    setTab(t);
    router.replace(`${pathname}${t === "workspace" ? "" : `?tab=${t}`}`, { scroll: false });
  }

  return (
    <>
      <Tabs
        label="Settings sections"
        idPrefix="settings"
        value={tab}
        onChange={change}
        tabs={[
          { id: "workspace", label: "Your business", icon: <Building2 /> },
          { id: "members", label: "Team", icon: <Users />, count: memberCount },
          { id: "billing", label: "Billing & usage", icon: <CreditCard /> },
          ...(branding ? [{ id: "branding", label: "Branding", icon: <Palette /> }] : []),
          ...(account ? [{ id: "account", label: "Your account", icon: <UserRound /> }] : []),
        ]}
      />
      <TabPanel idPrefix="settings" value={tab} className="pt-8 animate-fade-in" key={tab}>
        {tab === "workspace"
          ? workspace
          : tab === "members"
            ? members
            : tab === "branding" && branding
              ? branding
              : tab === "account" && account
                ? account
                : billing}
      </TabPanel>
    </>
  );
}
