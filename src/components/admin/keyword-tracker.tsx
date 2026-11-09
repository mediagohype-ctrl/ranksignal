"use client";
// Keyword tracker for our own site: add phrases, map them to a page, record Google position and AI mentions.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Input, Notice, Select, useToast, type Tone } from "@/components/ui";
import { adminSend } from "./actions";

export interface KeywordRow {
  id: string;
  phrase: string;
  pillar: string;
  intent: string;
  targetPath: string | null;
  priority: number;
  googlePosition: number | null;
  aiMentioned: boolean | null;
  checkedAt: string | null;
  hasPage: boolean;
}

const posTone = (p: number | null): Tone => (p === null ? "neutral" : p <= 3 ? "success" : p <= 10 ? "primary" : p <= 30 ? "warning" : "danger");

function Row({ k, canManage, siteUrl }: { k: KeywordRow; canManage: boolean; siteUrl: string }) {
  const router = useRouter();
  const [pos, setPos] = useState(k.googlePosition?.toString() ?? "");
  const [target, setTarget] = useState(k.targetPath ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setErr(null);
    try {
      await adminSend(`/api/admin/seo/keywords/${k.id}`, "PATCH", body);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const google = `https://www.google.com/search?q=${encodeURIComponent(k.phrase)}&gl=in&hl=en`;
  const chatgpt = `https://chatgpt.com/?q=${encodeURIComponent(k.phrase)}`;
  const perplexity = `https://www.perplexity.ai/search?q=${encodeURIComponent(k.phrase)}`;

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2.5">
        <p className="font-medium text-fg">{k.phrase}</p>
        <p className="text-xs text-muted">
          {k.pillar.toUpperCase()} · {k.intent} · P{k.priority}
        </p>
        {err && <p className="text-xs text-danger">{err}</p>}
      </td>
      <td className="px-3 py-2.5">
        {canManage ? (
          <Input
            aria-label={`Target page for ${k.phrase}`}
            className="h-8 w-48 text-xs"
            value={target}
            placeholder="/blog/…"
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => target !== (k.targetPath ?? "") && patch({ targetPath: target.trim() || null })}
          />
        ) : (
          <span className="text-xs">{k.targetPath ?? "—"}</span>
        )}
        <p className="mt-1 text-xs">
          {k.hasPage ? (
            <a href={`${siteUrl}${k.targetPath}`} target="_blank" rel="noopener noreferrer" className="text-success hover:underline">
              Page is live
            </a>
          ) : (
            <Link href="/admin/content/new" className="font-medium text-danger hover:underline">
              No page yet — write one
            </Link>
          )}
        </p>
      </td>
      <td className="px-3 py-2.5">
        {canManage ? (
          <Input
            aria-label={`Google position for ${k.phrase}`}
            className="h-8 w-20 text-xs"
            inputMode="numeric"
            value={pos}
            placeholder="—"
            onChange={(e) => setPos(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onBlur={() => {
              const n = pos ? Math.min(100, Math.max(1, Number(pos))) : null;
              if (n !== k.googlePosition) void patch({ googlePosition: n });
            }}
          />
        ) : (
          <Badge tone={posTone(k.googlePosition)}>{k.googlePosition ?? "—"}</Badge>
        )}
      </td>
      <td className="px-3 py-2.5">
        {canManage ? (
          <Select
            aria-label={`Named by AI for ${k.phrase}`}
            className="h-8 text-xs"
            value={k.aiMentioned === null ? "" : k.aiMentioned ? "yes" : "no"}
            onChange={(e) => patch({ aiMentioned: e.target.value === "" ? null : e.target.value === "yes" })}
          >
            <option value="">Not checked</option>
            <option value="yes">Yes, named</option>
            <option value="no">No</option>
          </Select>
        ) : (
          <span className="text-xs">{k.aiMentioned === null ? "—" : k.aiMentioned ? "Yes" : "No"}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span className="flex flex-wrap gap-x-2 gap-y-1">
          <a href={google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            Google <ExternalLink className="size-3" aria-hidden />
          </a>
          <a href={chatgpt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            ChatGPT <ExternalLink className="size-3" aria-hidden />
          </a>
          <a href={perplexity} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            Perplexity <ExternalLink className="size-3" aria-hidden />
          </a>
        </span>
        <span className="mt-1 block text-muted">{k.checkedAt ? `Checked ${new Date(k.checkedAt).toLocaleDateString("en-IN")}` : "Never checked"}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        {canManage && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${k.phrase}`}
            onClick={async () => {
              if (!window.confirm(`Stop tracking “${k.phrase}”?`)) return;
              try {
                await adminSend(`/api/admin/seo/keywords/${k.id}`, "DELETE");
                router.refresh();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            <Trash2 />
          </Button>
        )}
      </td>
    </tr>
  );
}

export function KeywordTracker({ rows, canManage, siteUrl }: { rows: KeywordRow[]; canManage: boolean; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [phrase, setPhrase] = useState("");
  const [pillar, setPillar] = useState("seo");
  const [intent, setIntent] = useState("informational");
  const [priority, setPriority] = useState("2");
  const [targetPath, setTargetPath] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("add");
            setError(null);
            try {
              await adminSend("/api/admin/seo/keywords", "POST", { phrase, pillar, intent, priority: Number(priority), targetPath: targetPath.trim() || null });
              setPhrase("");
              setTargetPath("");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(null);
            }
          }}
        >
          <Input aria-label="Search phrase" className="w-64" required placeholder="search phrase, e.g. seo company in delhi" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          <Select aria-label="Pillar" className="w-24" value={pillar} onChange={(e) => setPillar(e.target.value)}>
            <option value="seo">SEO</option>
            <option value="aeo">AEO</option>
            <option value="geo">GEO</option>
          </Select>
          <Select aria-label="Intent" className="w-40" value={intent} onChange={(e) => setIntent(e.target.value)}>
            <option value="informational">Informational</option>
            <option value="commercial">Commercial</option>
            <option value="transactional">Transactional</option>
            <option value="navigational">Navigational</option>
          </Select>
          <Select aria-label="Priority" className="w-28" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="1">P1 high</option>
            <option value="2">P2 medium</option>
            <option value="3">P3 low</option>
          </Select>
          <Input aria-label="Target page" className="w-48" placeholder="/blog/… (optional)" value={targetPath} onChange={(e) => setTargetPath(e.target.value)} />
          <Button type="submit" icon={<Plus />} loading={busy === "add"}>
            Track
          </Button>
          {rows.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              icon={<Sparkles />}
              loading={busy === "starter"}
              onClick={async () => {
                setBusy("starter");
                try {
                  const r = await adminSend<{ added: number }>("/api/admin/seo/keywords", "POST", { starter: true });
                  toast(`Added ${r?.added ?? 0} starter keywords`, "success");
                  router.refresh();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Add starter keywords
            </Button>
          )}
        </form>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {rows.length === 0 ? (
        <p className="text-small text-muted">No keywords tracked yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-left text-small">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Phrase</th>
                <th className="px-3 py-2 font-medium">Our page</th>
                <th className="px-3 py-2 font-medium">Google position</th>
                <th className="px-3 py-2 font-medium">Named by AI?</th>
                <th className="px-3 py-2 font-medium">Check now</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <Row key={k.id} k={k} canManage={canManage} siteUrl={siteUrl} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
