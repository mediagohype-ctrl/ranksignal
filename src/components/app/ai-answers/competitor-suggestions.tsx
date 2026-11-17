"use client";
// "Who are your competitors?" — the businesses AI already names or links for this website's questions, with a
// one-click Add. Shown where "You vs competitors" would otherwise show the business on its own (old accounts with
// no competitors saved). Loads its own data, and shows nothing when there is nothing to suggest.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Badge, Button, Card, CardBody, CardHeader, useToast } from "@/components/ui";

interface Suggestion {
  domain: string;
  name: string;
  count: number;
  reason: "named" | "same_trade";
}

interface Payload {
  items: Suggestion[];
  saved: number;
  measuredAt: string | null;
}

export function CompetitorSuggestions({
  projectId,
  canEdit,
  onlyWhenNoneSaved = false,
  initial,
  title = "Add your competitors",
}: {
  projectId: string;
  canEdit: boolean;
  /** Show only while the website has no competitors saved (AI answers page, full report). */
  onlyWhenNoneSaved?: boolean;
  /** Suggestions already loaded on the server (skips the request). */
  initial?: Suggestion[];
  title?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(initial ? { items: initial, saved: 0, measuredAt: null } : null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    const ctrl = new AbortController();
    api<{ item: Payload }>(`/api/projects/${projectId}/competitors/suggestions`, { signal: ctrl.signal })
      .then((r) => setData(r.item))
      .catch(() => undefined); // a suggestion box that can't load just stays hidden
    return () => ctrl.abort();
  }, [projectId, initial]);

  if (!data || data.items.length === 0) return null;
  if (onlyWhenNoneSaved && data.saved > 0 && added.size === 0) return null;

  async function add(s: Suggestion) {
    setBusy(s.domain);
    try {
      await api(`/api/projects/${projectId}/competitors/suggestions/add`, { body: { domain: s.domain, name: s.name } });
      setAdded((prev) => new Set(prev).add(s.domain));
      toast(`${s.name} added as a competitor. Your next AI check will compare you with them.`, "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title={title}
        description="AI already names or links to these businesses when your customers ask their questions. Add the ones you compete with, so we can show how often AI names them and you."
      />
      <CardBody>
        <ul className="divide-y divide-border">
          {data.items.map((s) => (
            <li key={s.domain} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-small font-medium text-fg">
                  {s.name} <span className="font-normal text-muted">· {s.domain}</span>
                </div>
                <div className="text-xs text-muted">
                  {s.reason === "named" ? "Named in AI answers" : "Looks like a business like yours"} · linked in{" "}
                  <span className="tabular-nums">{s.count}</span> {s.count === 1 ? "answer" : "answers"}
                </div>
              </div>
              {added.has(s.domain) ? (
                <Badge tone="success" icon={<Check />}>
                  Added
                </Badge>
              ) : (
                canEdit && (
                  <Button size="sm" variant="secondary" icon={<Plus />} loading={busy === s.domain} onClick={() => void add(s)} aria-label={`Add ${s.name} as a competitor`}>
                    Add
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Not a competitor? Just leave it. You can change your competitors any time in your website settings.</p>
      </CardBody>
    </Card>
  );
}
