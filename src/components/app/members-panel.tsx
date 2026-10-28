"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, UserMinus, UserPlus, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  Notice,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  fieldDescribedBy,
  useToast,
} from "@/components/ui";

interface Member {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  invitedAt: string | null;
  user: { id: string; email: string; name: string | null };
}

const ROLES = ["owner", "admin", "member", "viewer"] as const;
const ROLE_HELP: Record<string, string> = {
  owner: "Owner — full control, including billing",
  admin: "Admin — manage team, billing and settings",
  member: "Member — run scans and draft fixes",
  viewer: "Viewer — read-only access",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MembersPanel({
  canManage,
  currentUserId,
  seatLimit,
}: {
  canManage: boolean;
  currentUserId: string;
  seatLimit?: number;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Member[] }>("/api/org/members");
      setItems(r.items);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!EMAIL_RE.test(addr)) {
      setInviteError("Enter a valid email address, e.g. teammate@company.com");
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      await api("/api/org/members", { body: { email: addr, role } });
      toast(`Invitation sent to ${addr}.`, "success");
      setEmail("");
      await load();
    } catch (err) {
      setInviteError(errorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(m: Member, next: string) {
    setBusy(m.id);
    try {
      await api(`/api/org/members/${m.id}`, { method: "PATCH", body: { role: next } });
      toast(`${m.user.name ?? m.user.email} is now ${next}.`, "success");
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: Member) {
    setBusy(m.id);
    try {
      await api(`/api/org/members/${m.id}`, { method: "DELETE" });
      toast("Member removed.", "success");
      setRemoving(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const active = items?.filter((m) => m.status !== "removed") ?? [];
  const seatsFull = seatLimit !== undefined && active.length >= seatLimit;

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader
            icon={<UserPlus />}
            title="Invite a teammate"
            description="They'll get an email with a link to join this workspace."
            actions={
              seatLimit !== undefined && items ? (
                <Badge tone={seatsFull ? "warning" : "neutral"}>
                  {active.length} of {seatLimit} seats used
                </Badge>
              ) : undefined
            }
          />
          <CardBody>
            <form onSubmit={invite} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-start">
              <Field label="Email address" htmlFor="inv-email" error={inviteError}>
                <Input
                  id="inv-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  invalid={!!inviteError}
                  aria-describedby={fieldDescribedBy("inv-email", { error: inviteError })}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="teammate@company.com"
                />
              </Field>
              <Field label="Role" htmlFor="inv-role" hint={ROLE_HELP[role]}>
                <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)} aria-describedby="inv-role-hint">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" loading={inviting} loadingText="Sending…" icon={<UserPlus />} className="sm:mt-7" disabled={seatsFull}>
                Send invite
              </Button>
            </form>
            {seatsFull && (
              <p className="mt-3 text-xs text-muted">All seats on your plan are in use. Upgrade under Billing &amp; usage to add more people.</p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<Users />}
          title="Team members"
          description={canManage ? "Change roles or remove access. You can't change your own role." : "Only owners and admins can invite people or change roles."}
          actions={
            <Button variant="ghost" size="icon-sm" aria-label="Refresh member list" onClick={load}>
              <RefreshCw />
            </Button>
          }
        />
        {error ? (
          <CardBody>
            <Notice tone="danger" title="Couldn't load members" actions={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>
              {error}
            </Notice>
          </CardBody>
        ) : !items ? (
          <CardBody className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8" rounded="full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-24" rounded="lg" />
              </div>
            ))}
          </CardBody>
        ) : active.length === 0 ? (
          <EmptyState size="sm" icon={<Users />} title="No members yet" description="Invite a teammate to share this workspace." />
        ) : (
          <Table caption="Workspace members">
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH className="hidden md:table-cell">Since</TH>
                {canManage && (
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                )}
              </tr>
            </THead>
            <tbody>
              {active.map((m) => {
                const self = m.user.id === currentUserId;
                const display = m.user.name ?? m.user.email;
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={display} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">
                            {display} {self && <span className="font-normal text-muted">(you)</span>}
                          </div>
                          {m.user.name && <div className="truncate text-xs text-muted">{m.user.email}</div>}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      {canManage && !self ? (
                        <>
                          <label className="sr-only" htmlFor={`role-${m.id}`}>
                            Role for {m.user.email}
                          </label>
                          <Select
                            id={`role-${m.id}`}
                            inputSize="sm"
                            value={m.role}
                            disabled={busy === m.id}
                            onChange={(e) => changeRole(m, e.target.value)}
                            className="w-28"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r[0].toUpperCase() + r.slice(1)}
                              </option>
                            ))}
                          </Select>
                        </>
                      ) : (
                        <span className="capitalize text-fg-soft">{m.role}</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={m.status} />
                    </TD>
                    <TD className="hidden whitespace-nowrap text-muted md:table-cell">{fmtDate(m.invitedAt ?? m.createdAt)}</TD>
                    {canManage && (
                      <TD align="right">
                        {!self && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${display}`}
                            className="text-danger hover:text-danger"
                            onClick={() => setRemoving(m)}
                          >
                            <UserMinus />
                          </Button>
                        )}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this member?"
        description={removing ? `${removing.user.email} will lose access to this workspace straight away. You can invite them again later.` : undefined}
        icon={<UserMinus />}
        tone="danger"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={!!removing && busy === removing.id} onClick={() => removing && remove(removing)}>
              Remove member
            </Button>
          </>
        }
      />
    </div>
  );
}
