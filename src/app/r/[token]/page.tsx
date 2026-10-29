// Public, read-only client report. Outside /app (no auth); access is the signed share token + the project's
// current Project.settings.share (enabled && jti === tokenId). Invalid / revoked → friendly 404.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, ScanSearch } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { fmtDate, hostOf } from "@/lib/dashboard/format";
import { loadSharedReport } from "@/lib/share/server";
import { verifyShareToken } from "@/lib/share/token";
import { db } from "@/lib/db";
import { DEFAULT_BRANDING, getBranding, toPublicBranding, type PublicBranding } from "@/lib/branding";
import { MeasuredWith } from "@/components/app/providers-status";
import { PrintButton } from "@/components/app/print-button";
import { ReportBody } from "@/components/app/report/report-body";
import { Badge, Card, EmptyState, LinkButton, Notice } from "@/components/ui";
import { LogoLockup } from "@/components/brand/logo";
import { clientIpFromHeaders } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared visibility report",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** Trusted client IP (rightmost proxy hop), same rules as the API rate limits. */
async function clientIpFromRequest(): Promise<string> {
  return clientIpFromHeaders(await headers()) || "unknown";
}

const DEFAULT_PUBLIC = toPublicBranding(DEFAULT_BRANDING);

/** White-label branding of the org that owns the shared project (default branding on any failure). */
async function brandingForToken(token: string): Promise<PublicBranding> {
  try {
    const claims = await verifyShareToken(token);
    if (!claims) return DEFAULT_PUBLIC;
    const project = await db.project.findUnique({ where: { id: claims.projectId }, select: { organizationId: true } });
    return project ? toPublicBranding(await getBranding(project.organizationId)) : DEFAULT_PUBLIC;
  } catch {
    return DEFAULT_PUBLIC;
  }
}

function BrandHeaderMark({ b }: { b: PublicBranding }) {
  if (!b.custom) return <LogoLockup size="sm" />;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {b.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- customer logo from an arbitrary https host (validated https-only)
        <img src={b.logoUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-auto max-w-[160px] object-contain" />
      )}
      <span className="truncate text-small font-semibold text-fg">{b.displayName}</span>
    </span>
  );
}

function Shell({ children, branding = DEFAULT_PUBLIC }: { children: React.ReactNode; branding?: PublicBranding }) {
  const b = branding;
  const showPoweredBy = !b.custom || !b.hidePoweredBy;
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        {b.custom && b.accentColor && <div aria-hidden className="h-1" style={{ background: b.accentColor }} />}
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <BrandHeaderMark b={b} />
          <Badge tone="neutral" size="sm">
            Shared report · read only
          </Badge>
        </div>
      </header>
      <main className="container-page space-y-10 py-10">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          {b.custom ? (
            <span>
              Report by <span className="font-semibold text-fg-soft">{b.displayName}</span>
              {b.footerText && <> · {b.footerText}</>}
              {showPoweredBy && <> · Powered by {BRAND.name}</>}
            </span>
          ) : (
            <span>
              Report by <span className="font-semibold text-fg-soft">{BRAND.name}</span> · {BRAND.tagline}
            </span>
          )}
          {showPoweredBy && (
            <a href="/free-check" className="focus-ring rounded text-primary hover:underline">
              Check your own website for free
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rl = checkRateLimit(`share-view:${await clientIpFromRequest()}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return (
      <Shell>
        <Notice tone="warning" icon={<Clock />} title="Too many requests">
          This report has been opened many times from your network in the last minute. Please wait {rl.retryAfterSec} seconds and refresh.
        </Notice>
      </Shell>
    );
  }

  let result: Awaited<ReturnType<typeof loadSharedReport>>;
  try {
    result = await loadSharedReport(token);
  } catch (e) {
    console.error("[share] shared report failed", e instanceof Error ? e.message : e);
    return (
      <Shell>
        <Notice tone="danger" title="We couldn't load this report">
          Something went wrong on our side. Please try again in a few minutes.
        </Notice>
      </Shell>
    );
  }
  if (result.status === "not_found") notFound();
  const branding = await brandingForToken(token);

  if (result.status === "not_ready") {
    return (
      <Shell branding={branding}>
        <EmptyState
          size="lg"
          icon={<ScanSearch />}
          title={`${result.brand}'s report isn't ready yet`}
          description="The website scan for this report hasn't finished. Check back a little later — this link will show the report as soon as it's ready."
          bordered
        />
      </Shell>
    );
  }

  const r = result.report;
  return (
    <Shell branding={branding}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">SEO · AEO · GEO report</p>
          <h1 className="mt-2 text-h1 text-balance text-fg">
            {r.brand} <span className="text-muted">— {hostOf(r.websiteUrl)}</span>
          </h1>
          <p className="mt-2 max-w-3xl text-body text-fg-soft">
            How easily Google and AI assistants can find, understand and recommend {r.brand} — and what to fix first.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-small text-muted">
            <span>Generated {fmtDate(r.generatedAt, true)}</span>
            <span aria-hidden>·</span>
            <span>Website scanned {fmtDate(r.crawl.finishedAt)}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {r.crawl.pagesCrawled} {r.crawl.pagesCrawled === 1 ? "page" : "pages"} scanned
            </span>
          </p>
        </div>
        <div className="no-print shrink-0">
          <PrintButton />
        </div>
      </div>

      <ReportBody report={r} readOnly measuredWith={<MeasuredWith labels={r.aiVisibility.providers} />} />

      {!branding.custom && (
        <Card variant="brand" padding="lg" as="aside" className="no-print">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-h4 text-navy-fg">Want a report like this for your website?</p>
              <p className="mt-1 text-small text-navy-fg/75">
                {BRAND.name} checks how Google and AI assistants see your business and explains what to fix, in plain English.
              </p>
            </div>
            <LinkButton href="/free-check" variant="accent" size="lg" iconRight={<ArrowRight />}>
              Run a free check
            </LinkButton>
          </div>
        </Card>
      )}
    </Shell>
  );
}
