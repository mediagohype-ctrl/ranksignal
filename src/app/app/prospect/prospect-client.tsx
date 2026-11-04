"use client";
// Prospect report form + branded one-page printable report. Print hides everything except the report sheet.
import { useState, type FormEvent } from "react";
import { Bot, CheckCircle2, CircleAlert, Search } from "lucide-react";
import type { PublicBranding } from "@/lib/branding";
import type { ProspectReport } from "@/lib/growth/prospect";
import { PrintButton } from "@/components/app/print-button";
import { Button, Card, CardBody, Field, Input, Notice, ScoreRing, SCORE_BAND_CLASS, scoreBand } from "@/components/ui";

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  body * { visibility: hidden !important; }
  #prospect-sheet, #prospect-sheet * { visibility: visible !important; }
  #prospect-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; }
}`;

const EFFORT: Record<string, string> = { quick: "Quick fix", moderate: "A few hours", involved: "Bigger job" };
const IMPACT: Record<string, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ProspectClient({ branding, orgName, canRun }: { branding: PublicBranding; orgName: string; canRun: boolean }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProspectReport | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Type your client's website, like example.com.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { item?: ProspectReport; error?: { message?: string } } | null;
      if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "We couldn't check that website. Check the address and try again.");
      setReport(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const agencyName = branding.custom ? branding.displayName : orgName;
  const accent = branding.accentColor ?? undefined;
  const band = SCORE_BAND_CLASS[scoreBand(report?.score)];

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>
      <Card className="no-print">
        <CardBody>
          <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Client's website" htmlFor="prospect-url" className="flex-1">
              <Input id="prospect-url" placeholder="example.com" value={url} maxLength={2048} onChange={(e) => setUrl(e.target.value)} disabled={!canRun} />
            </Field>
            <Button type="submit" loading={busy} disabled={busy || !canRun} icon={<Search />}>
              {busy ? "Checking (about 30 seconds)…" : "Make report"}
            </Button>
          </form>
          {!canRun && <p className="mt-3 text-small text-muted">Viewers can&apos;t make reports. Ask an Admin.</p>}
          {error && (
            <Notice tone="danger" className="mt-4">
              {error}
            </Notice>
          )}
        </CardBody>
      </Card>

      {report && (
        <>
          <div className="no-print flex justify-end">
            <PrintButton label="Print or download PDF" variant="primary" />
          </div>
          <article id="prospect-sheet" className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-8 text-fg shadow-sm">
            {accent && <div aria-hidden className="-mx-8 -mt-8 mb-6 h-1.5 rounded-t-2xl" style={{ background: accent }} />}
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
              <div className="flex min-w-0 items-center gap-3">
                {branding.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- customer logo from an https host (validated)
                  <img src={branding.logoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-auto max-w-[180px] object-contain" />
                )}
                <span className="truncate text-h4 font-semibold">{agencyName}</span>
              </div>
              <div className="text-right text-xs text-muted">
                <p>Website check for</p>
                <p className="text-small font-semibold text-fg">{report.brand ?? hostOf(report.url)}</p>
                <p>{new Date(report.checkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </header>

            <section className="flex flex-wrap items-center gap-6 py-6">
              <ScoreRing score={report.score} size="lg" label="Score" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className={`text-small font-semibold ${band.text}`}>{band.label}</p>
                <p className="text-lead">{report.headline}</p>
                <p className="text-xs text-muted">
                  {hostOf(report.url)} · we read {report.pagesChecked === 1 ? "1 page" : `${report.pagesChecked} pages`}
                </p>
              </div>
            </section>

            {report.pillars.length > 0 && (
              <section className="grid grid-cols-2 gap-3 border-y border-border py-4 sm:grid-cols-4">
                {report.pillars.map((p) => (
                  <div key={p.label}>
                    <p className="text-xs text-muted">{p.label}</p>
                    <p className={`text-h4 font-semibold ${SCORE_BAND_CLASS[scoreBand(p.score)].text}`}>{p.score ?? "—"}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="py-6">
              <h2 className="text-h4 font-semibold" style={accent ? { color: accent } : undefined}>
                Top 3 fixes
              </h2>
              {report.topFixes.length === 0 ? (
                <p className="mt-2 text-small text-muted">No big problems found. Nice work.</p>
              ) : (
                <ol className="mt-3 space-y-4">
                  {report.topFixes.map((f, i) => (
                    <li key={f.title} className="flex gap-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-semibold">{f.title}</p>
                        <p className="text-small text-fg-soft">{f.whatsWrong}</p>
                        {f.howToFix[0] && <p className="mt-1 text-small">How to fix: {f.howToFix[0]}</p>}
                        <p className="mt-1 text-xs text-muted">
                          {IMPACT[f.impact] ?? "Important"} · {EFFORT[f.effort] ?? "A few hours"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="border-t border-border py-6">
              <h2 className="flex items-center gap-2 text-h4 font-semibold" style={accent ? { color: accent } : undefined}>
                <Bot className="size-5" aria-hidden /> What AI tools need
              </h2>
              <p className="mt-1 text-small text-muted">
                ChatGPT, Gemini and other AI tools can only name a business they can read and understand.
              </p>
              <ul className="mt-3 space-y-2">
                {report.aiNeeds.map((n) => (
                  <li key={n.label} className="flex gap-2 text-small">
                    {n.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-score-good" aria-label="Done" />
                    ) : (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-ok" aria-label="To do" />
                    )}
                    <span>
                      <span className="font-medium">{n.label}:</span> {n.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {report.strengths.length > 0 && (
              <section className="border-t border-border py-6">
                <h2 className="text-h4 font-semibold">Already good</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-fg-soft">
                  {report.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="border-t border-border pt-4 text-xs text-muted">
              <p>
                Want this fixed? {agencyName} can fix these and check what AI says about {report.brand ?? hostOf(report.url)} every week.
              </p>
              {branding.footerText && <p className="mt-1">{branding.footerText}</p>}
              <p className="mt-1">This check reads the website only. It does not ask AI tools about the business.</p>
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
