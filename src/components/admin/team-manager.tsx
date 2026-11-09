"use client";
// Team & roles: add staff by email with roles, change roles, remove access. Every change needs a reason (audit log).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Field, Input, Notice, useToast } from "@/components/ui";
import { adminSend } from "./actions";

export interface RoleOption {
  id: string;
  label: string;
  description: string;
}

export interface TeamMemberView {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  since: string;
  isSelf: boolean;
}

function RolePicker({ options, value, onChange, name }: { options: RoleOption[]; value: string[]; onChange: (v: string[]) => void; name: string }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="sr-only">Roles</legend>
      {options.map((o) => {
        const checked = value.includes(o.id);
        return (
          <label
            key={o.id}
            className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-small ${checked ? "border-primary bg-primary-soft/40" : "border-border hover:bg-surface-2"}`}
          >
            <input
              type="checkbox"
              name={name}
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((r) => r !== o.id))}
            />
            <span>
              <span className="block font-medium text-fg">{o.label}</span>
              <span className="block text-xs text-muted">{o.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function askReason(what: string): string | null {
  const r = window.prompt(`Reason for ${what} (ticket number or short note, min 3 characters):`);
  return r && r.trim().length >= 3 ? r.trim() : null;
}

export function AddStaffForm({ options, initialEmail }: { options: RoleOption[]; initialEmail?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [roles, setRoles] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await adminSend("/api/admin/team", "POST", { email, roles, reason });
          toast(`${email} added to the team`, "success");
          setEmail("");
          setRoles([]);
          setReason("");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email of their MyWebRank account" htmlFor="staff-email" hint="They must sign up first.">
          <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Field>
        <Field label="Reason" htmlFor="staff-reason" hint="Saved in the audit log.">
          <Input id="staff-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="New SEO hire, ticket #123" />
        </Field>
      </div>
      <RolePicker options={options} value={roles} onChange={setRoles} name="new-roles" />
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" icon={<UserPlus />} loading={busy} disabled={!email || roles.length === 0 || reason.trim().length < 3}>
          Add to team
        </Button>
      </div>
    </form>
  );
}

export function TeamMemberRow({ member, options }: { member: TeamMemberView; options: RoleOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [roles, setRoles] = useState<string[]>(member.roles);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  async function run(kind: "save" | "remove") {
    const reason = askReason(kind === "save" ? `changing ${member.email}'s roles` : `removing ${member.email} from the team`);
    if (!reason) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "save") await adminSend(`/api/admin/team/${member.id}`, "PATCH", { roles, reason });
      else await adminSend(`/api/admin/team/${member.id}`, "DELETE", { reason });
      toast(kind === "save" ? "Roles updated" : "Removed from the team", "success");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-fg">
            {member.name ?? member.email} {member.isSelf && <Badge size="sm">You</Badge>}
          </p>
          <p className="truncate text-xs text-muted">
            {member.email} · staff since {member.since}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.roles.length ? (
              member.roles.map((r) => (
                <Badge key={r} size="sm" tone={r === "super_admin" ? "danger" : "primary"}>
                  {label(r)}
                </Badge>
              ))
            ) : (
              <Badge size="sm" tone="warning">
                No role — sees nothing
              </Badge>
            )}
          </div>
        </div>
        {!member.isSelf && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Change roles"}
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 />} loading={busy === "remove"} onClick={() => run("remove")}>
              Remove
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <div className="space-y-3">
          <RolePicker options={options} value={roles} onChange={setRoles} name={`roles-${member.id}`} />
          <div className="flex justify-end">
            <Button size="sm" icon={<Save />} loading={busy === "save"} disabled={roles.length === 0} onClick={() => run("save")}>
              Save roles
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </li>
  );
}
