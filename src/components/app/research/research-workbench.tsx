"use client";
// Research page body: two tabs (Keyword ideas | Google top 10). Both panels stay mounted so switching tabs keeps results.
import { useState } from "react";
import { Tabs, TabPanel } from "@/components/ui";
import { KeywordIdeasPanel } from "./keyword-ideas-panel";
import { SerpPanel } from "./serp-panel";
import type { Overview } from "./shared";

type TabId = "keywords" | "serp";

export function ResearchWorkbench({
  projectId, keywords, serp, canSearch, ownDomain, competitorCount,
}: {
  projectId: string;
  keywords: Overview;
  serp: Overview;
  canSearch: boolean;
  ownDomain: string | null;
  competitorCount: number;
}) {
  const [tab, setTab] = useState<TabId>("keywords");
  return (
    <div className="space-y-6">
      <Tabs
        label="Research tools"
        idPrefix="research"
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: "keywords", label: "Keyword ideas" },
          { id: "serp", label: "Google top 10" },
        ]}
      />
      <TabPanel idPrefix="research" value={tab}>
        <div hidden={tab !== "keywords"}>
          <KeywordIdeasPanel projectId={projectId} initial={keywords} canSearch={canSearch} canTrack={canSearch} />
        </div>
        <div hidden={tab !== "serp"}>
          <SerpPanel projectId={projectId} initial={serp} canSearch={canSearch} canTrack={canSearch} ownDomain={ownDomain} competitorCount={competitorCount} />
        </div>
      </TabPanel>
    </div>
  );
}
