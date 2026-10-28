"use client";
// Staff review controls: edit summary + headline bullets, save, approve & send, regenerate.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Save, Send } from "lucide-react";
import { Button, Card, CardBody, CardFooter, CardHeader, Dialog, Field, Input, Select, Textarea, useToast } from "@/components/ui";

type Headline = { gains: string[]; risks: string[]; nextActions: string[] };
const KEYS: { key: keyof Headline; label: string }[] = [
  { key: "gains", label: "Gains" },
  { key: "risks", label: "Risks" },
  { key: "nextActions", label: "Next actions" },
];

const pad3 = (a: string[]) => [...a, "", "", ""].slice(0, 3);

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Request failed");
  return data;
}

export function ReviewEditor({
  reportId, initialSummary, initialHeadline, sent, clientLabel,
}: { reportId: string; initialSummary: string; initialHeadline: Headline; sent: boolean; clientLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [summary, setSummary] = useState(initialSummary);
  const [headline, setHeadline] = useState<Headline>({
    gains: pad3(initialHeadline.gains), risks: pad3(initialHeadline.risks), nextActions: pad3(initialHeadline.nextActions),
  });
  const [busy, setBusy] = useState<null | "save" | "send" | "regen">(null);
  const [confirm, setConfirm] = useState<null | "send" | "regen">(null);
  const dirty =
    summary !== initialSummary ||
    KEYS.some(({ key }) => headline[key].join("\u0000") !== pad3(initialHeadline[key]).join("\u0000"));

  const clean = (): Headline => ({
    gains: headline.gains.map((s) => s.trim()).filter(Boolean),
    risks: headline.risks.map((s) => s.trim()).filter(Boolean),
    nextActions: headline.nextActions.map((s) => s.trim()).filter(Boolean),
  });

  async function save(): Promise<boolean> {
    setBusy("save");
    try {
      await call(`/api/admin/monthly-reports/${reportId}`, "PATCH", { summary: summary.trim(), headline: clean() });
      toast("Changes saved", "success");
      router.refresh();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (dirty && !(await save())) return;
    setBusy("send");
    try {
      await call(`/api/admin/monthly-reports/${reportId}/approve`, "POST");
      toast("Report approved and sent", "success");
      setConfirm(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regen");
    try {
      await call(`/api/admin/monthly-reports/${reportId}/regenerate`, "POST");
      toast("Report regenerated from the latest data", "success");
      setConfirm(null);
      router.refresh();
      window.location.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (sent) return null;

  return (
    <Card>
      <CardHeader title="Review" description="Edit the wording, preview below, then approve and send. Plain English; no promises of rankings or results." />
      <CardBody className="space-y-5">
        <Field label="Summary" htmlFor="mr-summary" hint="4–6 short sentences, facts only.">
          <Textarea id="mr-summary" rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={3000} />
        </Field>
        <div className="grid gap-5 lg:grid-cols-3">
          {KEYS.map(({ key, label }) => (
            <fieldset key={key} className="space-y-2">
              <legend className="mb-1 text-small font-medium text-fg">{label}</legend>
              {headline[key].map((v, i) => (
                <Input
                  key={i}
                  aria-label={`${label} ${i + 1}`}
                  value={v}
                  maxLength={300}
                  placeholder={i === 0 ? "Optional" : ""}
                  inputSize="sm"
                  onChange={(e) => setHeadline((h) => ({ ...h, [key]: h[key].map((x, j) => (j === i ? e.target.value : x)) }))}
                />
              ))}
            </fieldset>
          ))}
        </div>
      </CardBody>
      <CardFooter>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" icon={<RefreshCw />} onClick={() => setConfirm("regen")} disabled={!!busy}>
            Regenerate
          </Button>
          <Button variant="secondary" icon={<Save />} onClick={save} loading={busy === "save"} disabled={!dirty || !!busy}>
            Save changes
          </Button>
          <Button icon={<Send />} onClick={() => setConfirm("send")} disabled={!!busy || !summary.trim()}>
            Approve &amp; send
          </Button>
        </div>
      </CardFooter>

      <Dialog
        open={confirm === "send"}
        onClose={() => setConfirm(null)}
        title="Approve and send this report?"
        description={`It will appear in ${clientLabel}'s report archive and owners/admins will be emailed (if email is on for this project).${dirty ? " Your unsaved edits will be saved first." : ""}`}
        icon={<Send />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button loading={busy === "send" || busy === "save"} loadingText="Sending…" onClick={approve}>Approve &amp; send</Button>
          </>
        }
      />
      <Dialog
        open={confirm === "regen"}
        onClose={() => setConfirm(null)}
        title="Regenerate from the latest data?"
        description="This rebuilds every number and replaces the summary and headline, including your edits. It stays a draft."
        icon={<RefreshCw />}
        tone="warning"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button loading={busy === "regen"} loadingText="Regenerating…" onClick={regenerate}>Regenerate</Button>
          </>
        }
      />
    </Card>
  );
}

export function GenerateNowForm({ projects, defaultPeriod }: { projects: { id: string; label: string }[]; defaultPeriod: string }) {
  const router = useRouter();
  const toast = useToast();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { item } = await call("/api/admin/monthly-reports", "POST", { projectId, period });
      toast(item.status === "sent" ? "This report was already sent; nothing changed" : "Draft generated", "success");
      router.push(`/admin/monthly-reports/${item.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Project" htmlFor="gen-project" className="min-w-[16rem] flex-1">
        <Select id="gen-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Month (UTC)" htmlFor="gen-period">
        <Input id="gen-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required inputSize="md" />
      </Field>
      <Button type="submit" icon={<RefreshCw />} loading={busy} loadingText="Generating…" disabled={!projectId}>
        Generate now
      </Button>
    </form>
  );
}
