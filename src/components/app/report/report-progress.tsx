import { ScanSearch, TriangleAlert } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { RunButtons } from "@/components/app/run-buttons";
import { Card, CardBody, EmptyState, LinkButton, Notice, ProgressSteps, type ProgressStep } from "@/components/ui";

export interface RunSnapshot {
  status: string;
  pagesCrawled?: number;
  pagesFound?: number;
  collected?: number;
  sampleSize?: number;
  error?: string | null;
}

const ACTIVE = ["queued", "preflight", "running", "retry_scheduled", "validating"];

/** Friendly "we're working on it" state shown while the first scan runs, with live progress. */
export function ReportInProgress({
  crawl,
  visibility,
  hasPrompts,
}: {
  crawl: RunSnapshot;
  visibility: RunSnapshot | null;
  hasPrompts: boolean;
}) {
  const crawlQueued = crawl.status === "queued" || crawl.status === "preflight" || crawl.status === "retry_scheduled";
  const pages = crawl.pagesCrawled ?? 0;
  const found = Math.max(crawl.pagesFound ?? 0, pages);
  const visActive = !!visibility && ACTIVE.includes(visibility.status);
  const visDone = !!visibility && (visibility.status === "succeeded" || visibility.status === "succeeded_with_warnings");
  const steps: ProgressStep[] = [
    {
      id: "crawl",
      label: "Read your pages",
      description: crawlQueued ? "Waiting to start…" : found ? `${pages} of ${found} pages read` : "Finding your pages…",
      status: crawlQueued || crawl.status === "running" || crawl.status === "retry_scheduled" ? "active" : "done",
    },
    {
      id: "audit",
      label: "Check for problems",
      description: "Titles, descriptions, structure, speed signals and AI-readiness",
      status: crawl.status === "validating" ? "active" : "pending",
    },
    {
      id: "measure",
      label: "Ask AI assistants about you",
      description: visibility
        ? visActive
          ? `${visibility.collected ?? 0} of ${visibility.sampleSize ?? "?"} answers collected`
          : visDone
            ? "Answers collected"
            : "Not run"
        : hasPrompts
          ? "Optional — start it any time with “Check AI visibility”"
          : "Optional — add questions on the Prompts page first",
      status: visActive ? "active" : visDone ? "done" : "pending",
    },
    { id: "report", label: "Write your report", description: "Scores, plain-English fixes and quick wins", status: "pending" },
  ];

  return (
    <Card>
      <CardBody className="py-8 sm:px-8">
        <AutoRefresh active intervalMs={3000} />
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">Working on it</p>
            <h2 className="mt-2 text-h2 text-balance text-fg">We&apos;re scanning your website</h2>
            <p className="mt-3 text-body text-fg-soft">
              This usually takes a minute or two for a small site. You can leave this page open — it updates by itself, and your report
              appears here as soon as the scan finishes.
            </p>
          </div>
          <ProgressSteps label="Report progress" steps={steps} />
        </div>
      </CardBody>
    </Card>
  );
}

/** Nothing scanned yet (or the last scan failed). */
export function ReportNoCrawl({
  projectId,
  canRun,
  failedError,
}: {
  projectId: string;
  canRun: boolean;
  failedError?: string | null;
}) {
  return (
    <div className="space-y-6">
      {failedError !== undefined && (
        <Notice tone="danger" icon={<TriangleAlert />} title="The last scan didn't finish">
          {failedError || "Something went wrong while reading your site."} Check that your website is online and try again.
        </Notice>
      )}
      <EmptyState
        size="lg"
        icon={<ScanSearch />}
        title="Your report starts with a website scan"
        description="We'll read your pages the way Google and AI assistants do, score your SEO, AEO and GEO, and explain exactly what to fix — in plain English."
        action={
          <RunButtons
            projectId={projectId}
            crawlActive={false}
            visibilityActive={false}
            canRun={canRun}
            show={["audit"]}
            labels={{ audit: "Scan my website" }}
            size="lg"
          />
        }
        secondaryAction={
          <LinkButton href={`/app/projects/${projectId}/prompts`} variant="ghost">
            Review the questions we&apos;ll ask AI
          </LinkButton>
        }
        bordered
      />
    </div>
  );
}
