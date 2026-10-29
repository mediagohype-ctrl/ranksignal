"use client";
import { useEffect, useState } from "react";
import { Globe2, Pencil } from "lucide-react";
import { Button, Dialog, Field, Input, Notice, Select, Textarea, fieldDescribedBy } from "@/components/ui";
import {
  OFFSITE_STATUSES,
  OFFSITE_TYPES,
  STATUS_LABEL,
  TYPE_LABEL,
  type OffsiteItemView,
  type OffsiteSource,
  type OffsiteStatus,
  type OffsiteType,
} from "@/lib/offsite/types";
import { offsiteApi } from "./offsite-api";

export interface OffsiteDraft {
  type: OffsiteType;
  name: string;
  url?: string | null;
  source?: OffsiteSource;
  notes?: string | null;
}

type Nap = "unknown" | "yes" | "no";

interface FormState {
  type: OffsiteType;
  name: string;
  url: string;
  status: OffsiteStatus;
  nap: Nap;
  notes: string;
  liveAt: string;
}

function init(item: OffsiteItemView | null, draft: OffsiteDraft | null): FormState {
  if (item) {
    return {
      type: item.type,
      name: item.name,
      url: item.url ?? "",
      status: item.status,
      nap: item.napConsistent === null ? "unknown" : item.napConsistent ? "yes" : "no",
      notes: item.notes ?? "",
      liveAt: item.liveAt ? item.liveAt.slice(0, 10) : "",
    };
  }
  return { type: draft?.type ?? "directory", name: draft?.name ?? "", url: draft?.url ?? "", status: "todo", nap: "unknown", notes: draft?.notes ?? "", liveAt: "" };
}

export function OffsiteFormDialog({
  open,
  onClose,
  projectId,
  item,
  draft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  item: OffsiteItemView | null;
  draft: OffsiteDraft | null;
  onSaved: (item: OffsiteItemView, created: boolean) => void;
}) {
  const [f, setF] = useState<FormState>(() => init(item, draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(init(item, draft));
      setError(null);
    }
  }, [open, item, draft]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const badUrl = f.url.trim() && !/^https?:\/\/\S+\.\S+/i.test(f.url.trim());

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.name.trim()) return setError("Add a name, e.g. “Justdial” or “Inc42 article”.");
    if (badUrl) return setError("The link must start with http:// or https://");
    setBusy(true);
    setError(null);
    const body = {
      type: f.type,
      name: f.name.trim(),
      url: f.url.trim() || null,
      status: f.status,
      napConsistent: f.nap === "unknown" ? null : f.nap === "yes",
      notes: f.notes.trim() || null,
      liveAt: f.status === "live" && f.liveAt ? f.liveAt : null,
      ...(!item && draft?.source ? { source: draft.source } : {}),
    };
    try {
      const res = item
        ? await offsiteApi<{ item: OffsiteItemView }>(`/api/projects/${projectId}/offsite/${item.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await offsiteApi<{ item: OffsiteItemView }>(`/api/projects/${projectId}/offsite`, { method: "POST", body: JSON.stringify(body) });
      onSaved(res.item, !item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  const id = (k: string) => `offsite-${k}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={item ? <Pencil /> : <Globe2 />}
      title={item ? "Edit off-site item" : "Add to off-site tracker"}
      description="A listing, review profile, press mention, forum thread or profile you're working on."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} loadingText="Saving…" onClick={() => void submit()}>
            {item ? "Save changes" : "Add item"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {!item && draft?.source === "ai_citation" && (
          <Notice tone="info" title="Suggested from AI answers">
            AI assistants cited this site in your latest check. Being listed there is worth considering — it doesn&apos;t guarantee
            you&apos;ll be mentioned.
          </Notice>
        )}
        {error && (
          <Notice tone="danger" title="Couldn't save">
            {error}
          </Notice>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor={id("name")} required>
            <Input id={id("name")} value={f.name} maxLength={200} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Type" htmlFor={id("type")}>
            <Select id={id("type")} value={f.type} onChange={(e) => set("type", e.target.value as OffsiteType)}>
              {OFFSITE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Link" htmlFor={id("url")} optional hint="The listing, profile or article page once it exists." error={badUrl ? "Must start with http:// or https://" : undefined}>
          <Input
            id={id("url")}
            type="url"
            inputMode="url"
            value={f.url}
            invalid={!!badUrl}
            onChange={(e) => set("url", e.target.value)}
            aria-describedby={fieldDescribedBy(id("url"), { hint: true, error: badUrl })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Status" htmlFor={id("status")}>
            <Select id={id("status")} value={f.status} onChange={(e) => set("status", e.target.value as OffsiteStatus)}>
              {OFFSITE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABEL[st]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name, address & phone match?" htmlFor={id("nap")} hint="Does the listing match your website?">
            <Select id={id("nap")} value={f.nap} onChange={(e) => set("nap", e.target.value as Nap)} aria-describedby={fieldDescribedBy(id("nap"), { hint: true })}>
              <option value="unknown">Not checked</option>
              <option value="yes">Yes, consistent</option>
              <option value="no">No, needs fixing</option>
            </Select>
          </Field>
          {f.status === "live" && (
            <Field label="Went live on" htmlFor={id("live")} optional hint="Defaults to today.">
              <Input id={id("live")} type="date" value={f.liveAt} onChange={(e) => set("liveAt", e.target.value)} aria-describedby={fieldDescribedBy(id("live"), { hint: true })} />
            </Field>
          )}
        </div>
        <Field label="Notes" htmlFor={id("notes")} optional>
          <Textarea id={id("notes")} rows={3} value={f.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
