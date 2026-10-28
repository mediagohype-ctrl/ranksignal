"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CreditCard, Users } from "lucide-react";
import { TabPanel, Tabs } from "@/components/ui";

const IDS = ["workspace", "members", "billing"] as const;
type TabId = (typeof IDS)[number];

function fromHash(hash: string): TabId | null {
  const h = hash.replace("#", "");
  if (h === "billing" || h === "usage") return "billing";
  if (h === "members") return "members";
  if (h === "workspace") return "workspace";
  return null;
}

export function SettingsTabs({
  workspace,
  members,
  billing,
  memberCount,
}: {
  workspace: React.ReactNode;
  members: React.ReactNode;
  billing: React.ReactNode;
  memberCount?: number;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("tab");
  const initial: TabId = IDS.includes(q as TabId) ? (q as TabId) : "workspace";
  const [tab, setTab] = useState<TabId>(initial);

  useEffect(() => {
    const h = fromHash(window.location.hash);
    if (h) setTab(h);
  }, []);
  useEffect(() => {
    if (IDS.includes(q as TabId)) setTab(q as TabId);
  }, [q]);

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
          { id: "workspace", label: "Workspace", icon: <Building2 /> },
          { id: "members", label: "Members", icon: <Users />, count: memberCount },
          { id: "billing", label: "Billing & usage", icon: <CreditCard /> },
        ]}
      />
      <TabPanel idPrefix="settings" value={tab} className="pt-8 animate-fade-in" key={tab}>
        {tab === "workspace" ? workspace : tab === "members" ? members : billing}
      </TabPanel>
    </>
  );
}
