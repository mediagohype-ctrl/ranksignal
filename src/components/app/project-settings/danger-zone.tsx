"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input, fieldDescribedBy, useToast } from "@/components/ui";

/** Admin-only project deletion with typed confirmation of the project name. */
export function DangerZone({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === projectName.trim();

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function confirm() {
    if (!matches) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      try {
        localStorage.removeItem("app.lastProjectId");
      } catch {
        /* storage unavailable */
      }
      toast(`Deleted ${projectName}.`, "success");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card as="section" variant="outlined" className="border-danger/40">
      <CardHeader title="Danger zone" description="Permanent actions. These can't be undone." icon={<AlertTriangle />} />
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-small font-semibold text-fg">Delete this project</h3>
            <p className="text-small text-muted">
              Removes all scans, reports, AI visibility results, questions and drafted changes for {projectName}. Changes already
              published to your website stay as they are.
            </p>
          </div>
          <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(true)} className="shrink-0">
            Delete project
          </Button>
        </div>
      </CardBody>
      <Dialog
        open={open}
        onClose={close}
        tone="danger"
        icon={<Trash2 />}
        title={`Delete ${projectName}?`}
        description="This permanently deletes the project and all of its history. It can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} loading={busy} loadingText="Deleting…" disabled={!matches}>
              Delete forever
            </Button>
          </>
        }
      >
        <Field label={`Type ${projectName} to confirm`} htmlFor="ps-delete-confirm" error={error ?? undefined}>
          <Input
            id="ps-delete-confirm"
            value={typed}
            autoComplete="off"
            invalid={!!error}
            aria-describedby={fieldDescribedBy("ps-delete-confirm", { error: error ?? undefined })}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) void confirm();
            }}
          />
        </Field>
      </Dialog>
    </Card>
  );
}
