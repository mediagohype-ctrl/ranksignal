// Public, read-only built client report (report builder share link). Access = the website's signed share token
// (src/lib/share) + that website's current share settings + the template's own share switch. Anything else → 404.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/auth/rate-limit";
import { loadSharedBuiltReport } from "@/lib/report-builder/public";
import { PrintButton } from "@/components/app/print-button";
import { BuiltReport } from "@/components/app/report-builder/report-view";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared client report",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export default async function SharedBuiltReportPage({ params }: { params: Promise<{ token: string; templateId: string }> }) {
  const { token, templateId } = await params;
  const ip = clientIpFromHeaders(await headers()) || "unknown";
  const rl = checkRateLimit(`share-view:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return (
      <main className="container-page py-10">
        <Notice tone="warning" icon={<Clock />} title="Too many requests">
          This report has been opened many times from your network in the last minute. Please wait {rl.retryAfterSec} seconds and refresh.
        </Notice>
      </main>
    );
  }

  let result: Awaited<ReturnType<typeof loadSharedBuiltReport>>;
  try {
    result = await loadSharedBuiltReport(token, templateId);
  } catch (e) {
    console.error("[share] built report failed", e instanceof Error ? e.message : e);
    return (
      <main className="container-page py-10">
        <Notice tone="danger" title="We couldn't load this report">
          Something went wrong on our side. Please try again in a few minutes.
        </Notice>
      </main>
    );
  }
  if (result.status !== "ok") notFound();
  const { data, template, branding } = result;

  return (
    <div className="min-h-screen bg-bg">
      <main className="container-page max-w-4xl py-10">
        <div className="no-print mb-6 flex justify-end">
          <PrintButton />
        </div>
        <BuiltReport data={data} sections={template.sections} intro={template.intro} notes={template.notes} branding={branding} />
      </main>
    </div>
  );
}
