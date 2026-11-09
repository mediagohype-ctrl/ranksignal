"use client";
// SEO command centre actions: live self-check of any page, and IndexNow submission.
import { useState } from "react";
import { Play, Send } from "lucide-react";
import { Badge, Button, Field, Input, Notice, useToast, type Tone } from "@/components/ui";
import { adminSend } from "./actions";

interface SelfCheck {
  url: string;
  checkedAt: string;
  overall: { score: number | null; grade: string | null; headline: string };
  pillars: { pillar: string; label: string; score: number | null; grade: string | null; summary: string }[];
  issues: { id: string; pillarLabel: string; title: string; whatsWrong: string; howToFix: string[] }[];
  totalIssues: number;
  strengths: string[];
}

const tone = (s: number | null): Tone => (s === null ? "neutral" : s >= 75 ? "success" : s >= 50 ? "warning" : "danger");

export function SelfCheckPanel({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SelfCheck | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            setResult((await adminSend<SelfCheck>("/api/admin/seo/self-check", "POST", { url })) ?? null);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Page to check (ours, or a competitor's)" htmlFor="seo-check-url" className="flex-1">
          <Input id="seo-check-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Button type="submit" icon={<Play />} loading={busy}>
          Run SEO / AEO / GEO check
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone(result.overall.score)} size="md">
              Overall {result.overall.score ?? "—"} {result.overall.grade ? `(${result.overall.grade})` : ""}
            </Badge>
            {result.pillars.map((p) => (
              <Badge key={p.pillar} tone={tone(p.score)} size="md" title={p.summary}>
                {p.label} {p.score ?? "—"}
              </Badge>
            ))}
            <span className="text-xs text-muted">
              {result.totalIssues} issue(s) · {new Date(result.checkedAt).toLocaleString("en-IN")}
            </span>
          </div>
          <p className="text-small text-fg-soft">{result.overall.headline}</p>
          {result.issues.length > 0 && (
            <ol className="list-decimal space-y-3 pl-5 text-small">
              {result.issues.map((i) => (
                <li key={i.id}>
                  <span className="font-medium text-fg">{i.title}</span> <span className="text-xs text-muted">({i.pillarLabel})</span>
                  <p className="text-fg-soft">{i.whatsWrong}</p>
                  {i.howToFix.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                      {i.howToFix.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {result.strengths.length > 0 && (
            <p className="text-xs text-muted">
              <strong className="text-fg-soft">Working well:</strong> {result.strengths.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function IndexNowButton({ configured }: { configured: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        icon={<Send />}
        variant="secondary"
        loading={busy}
        disabled={!configured}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await adminSend<{ message: string }>("/api/admin/seo/indexnow", "POST", { reason: "Submitted from SEO command centre" });
            setMsg({ tone: "success", text: r?.message ?? "Submitted." });
            toast("Submitted to IndexNow", "success");
          } catch (err) {
            setMsg({ tone: "danger", text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        Submit all pages to Bing (IndexNow)
      </Button>
      {!configured && <p className="text-xs text-muted">Set INDEXNOW_KEY on the server first.</p>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}
