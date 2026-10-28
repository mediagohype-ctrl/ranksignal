"use client";
import { useState, type FormEvent } from "react";
import { Download, KeyRound, MailCheck, Trash2, UserRound } from "lucide-react";
import { ApiClientError, api, errorMessage } from "@/lib/dashboard/client";
import {
  Badge,
  Button,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Field,
  Input,
  KeyValueList,
  Notice,
  fieldDescribedBy,
  useToast,
} from "@/components/ui";

const MIN_PASSWORD = 10;

function firstFieldError(err: unknown, field: string): string | undefined {
  if (!(err instanceof ApiClientError)) return undefined;
  const d = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return d?.fieldErrors?.[field]?.[0];
}

export function AccountPanel({ user }: { user: { name: string | null; email: string; emailVerified: boolean; createdAt: string } }) {
  return (
    <div className="space-y-6">
      <ProfileCard user={user} />
      <PasswordCard />
      <DataCard />
      <DeleteCard />
    </div>
  );
}

function ProfileCard({ user }: { user: { name: string | null; email: string; emailVerified: boolean; createdAt: string } }) {
  const toast = useToast();
  const [name, setName] = useState(user.name ?? "");
  const [saved, setSaved] = useState(user.name ?? "");
  const [err, setErr] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter your name.");
    setSaving(true);
    try {
      const r = await api<{ item: { name: string } }>("/api/account", { method: "PATCH", body: { name: name.trim() } });
      setSaved(r.item.name);
      setName(r.item.name);
      toast("Name updated.", "success");
    } catch (e2) {
      setErr(firstFieldError(e2, "name") ?? errorMessage(e2));
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setSending(true);
    try {
      await api("/api/auth/verify-email", { method: "POST" });
      toast(`Confirmation link sent to ${user.email}.`, "success");
    } catch (e2) {
      toast(errorMessage(e2), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<UserRound />} title="Your profile" description="How you appear to your teammates." />
      <CardBody className="space-y-6">
        <KeyValueList
          items={[
            {
              label: "Email",
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-all">{user.email}</span>
                  {user.emailVerified ? (
                    <Badge tone="success" variant="dot">
                      Confirmed
                    </Badge>
                  ) : (
                    <Badge tone="warning" variant="dot">
                      Not confirmed
                    </Badge>
                  )}
                </span>
              ),
              hint: user.emailVerified ? undefined : "Confirm it so reports and password resets reach you.",
            },
            { label: "Member since", value: new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) },
          ]}
        />
        {!user.emailVerified && (
          <Button size="sm" variant="secondary" icon={<MailCheck />} loading={sending} loadingText="Sending…" onClick={resend}>
            Resend confirmation email
          </Button>
        )}
        <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
          <Field label="Your name" htmlFor="acct-name" error={err}>
            <Input
              id="acct-name"
              autoComplete="name"
              maxLength={120}
              value={name}
              invalid={!!err}
              aria-describedby={fieldDescribedBy("acct-name", { error: err })}
              onChange={(e) => {
                setName(e.target.value);
                if (err) setErr(undefined);
              }}
            />
          </Field>
          <Button type="submit" className="sm:mt-7" loading={saving} loadingText="Saving…" disabled={name.trim() === saved}>
            Save name
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v: typeof errors = {};
    if (!form.currentPassword) v.currentPassword = "Enter your current password.";
    if (form.newPassword.length < MIN_PASSWORD) v.newPassword = `Use at least ${MIN_PASSWORD} characters.`;
    if (form.confirm !== form.newPassword) v.confirm = "The two passwords don't match.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await api("/api/account/password", { body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast("Password changed. We've emailed you a confirmation.", "success");
    } catch (err) {
      const cur = firstFieldError(err, "currentPassword");
      const nw = firstFieldError(err, "newPassword");
      if (cur || nw) setErrors({ currentPassword: cur, newPassword: nw });
      else toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<KeyRound />} title="Password" description="Use at least 10 characters. A short phrase you don't use elsewhere works well." />
      <CardBody>
        <form onSubmit={submit} noValidate className="max-w-md space-y-5">
          <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword}>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={set("currentPassword")}
              invalid={!!errors.currentPassword}
              aria-describedby={fieldDescribedBy("pw-current", { error: errors.currentPassword })}
            />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={errors.newPassword}>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={form.newPassword}
              onChange={set("newPassword")}
              invalid={!!errors.newPassword}
              aria-describedby={fieldDescribedBy("pw-new", { error: errors.newPassword })}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm}>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set("confirm")}
              invalid={!!errors.confirm}
              aria-describedby={fieldDescribedBy("pw-confirm", { error: errors.confirm })}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" loading={saving} loadingText="Changing…">
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function DataCard() {
  return (
    <Card>
      <CardHeader icon={<Download />} title="Download your data" description="Get a copy of the information we hold about you." />
      <CardBody className="space-y-4">
        <p className="text-small text-fg-soft">
          You&apos;ll get a JSON file with your profile and workspace memberships. For workspaces you own, it also includes projects, audit
          findings, suggested fixes and AI answer check results. Passwords and website connection credentials are never included.
        </p>
        <a
          href="/api/account/export"
          download
          className={buttonClass("secondary", "md", "w-fit")}
        >
          <Download aria-hidden /> Download my data
        </a>
      </CardBody>
    </Card>
  );
}

function DeleteCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | undefined>();

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
    setPwError(undefined);
  }

  async function del() {
    setError(null);
    setPwError(undefined);
    if (!password) return setPwError("Enter your password.");
    setBusy(true);
    try {
      await api("/api/account/delete", { body: { password, confirm } });
      window.location.assign("/login?deleted=1");
    } catch (err) {
      const fe = firstFieldError(err, "password");
      if (fe) setPwError(fe);
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<Trash2 />} title="Delete account" description="Permanently remove your account and personal data." />
      <CardBody className="space-y-4">
        <p className="text-small text-fg-soft">
          Deleting your account removes you from every workspace. If you&apos;re the only person in a workspace, that workspace and all its projects
          and reports are deleted too. If you&apos;re the only owner of a workspace that has other members, make someone else an owner first.
          This can&apos;t be undone.
        </p>
        <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardBody>
      <Dialog
        open={open}
        onClose={close}
        title="Delete your account?"
        description="This permanently deletes your account. Workspaces where you're the only member are deleted with all their data."
        icon={<Trash2 />}
        tone="danger"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} loadingText="Deleting…" disabled={confirm !== "DELETE" || !password} onClick={del}>
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Your password" htmlFor="del-password" error={pwError}>
            <Input
              id="del-password"
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={!!pwError}
              aria-describedby={fieldDescribedBy("del-password", { error: pwError })}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label='Type "DELETE" to confirm' htmlFor="del-confirm">
            <Input id="del-confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
