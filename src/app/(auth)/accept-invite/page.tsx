"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { Button, LinkButton, LoadingBlock, Notice } from "@/components/ui";
import { AuthHeading, postJson } from "../auth-ui";

type State =
  | { kind: "loading" }
  | { kind: "signin"; email?: string; organizationName?: string }
  | { kind: "wrong_account"; message: string }
  | { kind: "error"; message: string };

function AcceptInvite() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [signingOut, setSigningOut] = useState(false);

  const accept = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", message: "This invitation link is incomplete. Open the link from your email again." });
      return;
    }
    setState({ kind: "loading" });
    const res = await postJson<{ item: { organizationName: string } }>("/api/auth/accept-invite", { token });
    if (res.ok) {
      router.replace("/app");
      router.refresh();
      return;
    }
    if (res.status === 401) {
      const d = res.details as { email?: string; organizationName?: string } | undefined;
      setState({ kind: "signin", email: d?.email, organizationName: d?.organizationName });
    } else if (res.code === "wrong_account") {
      setState({ kind: "wrong_account", message: res.message ?? "This invitation was sent to a different email address." });
    } else {
      setState({ kind: "error", message: res.message ?? "We couldn't accept this invitation." });
    }
  }, [token, router]);

  useEffect(() => {
    void accept();
  }, [accept]);

  async function signOut() {
    setSigningOut(true);
    await postJson("/api/auth/logout", {});
    setSigningOut(false);
    await accept();
  }

  if (state.kind === "loading") return <LoadingBlock label="Accepting your invitation…" />;

  if (state.kind === "signin") {
    const next = `/accept-invite?token=${encodeURIComponent(token)}`;
    const emailQ = state.email ? `&email=${encodeURIComponent(state.email)}` : "";
    return (
      <>
        <AuthHeading
          title={state.organizationName ? `Join ${state.organizationName}` : "Accept your invitation"}
          subtitle={
            state.email
              ? `This invitation is for ${state.email}. Sign in, or create a free account with that email, to join.`
              : "Sign in, or create an account with the invited email, to join."
          }
        />
        <div className="flex flex-col gap-3">
          <LinkButton href={`/login?next=${encodeURIComponent(next)}${emailQ}`} size="lg" fullWidth icon={<LogIn />}>
            I already have an account
          </LinkButton>
          <LinkButton href={`/signup?next=${encodeURIComponent(next)}${emailQ}`} size="lg" variant="secondary" fullWidth icon={<UserPlus />}>
            Create my account
          </LinkButton>
        </div>
      </>
    );
  }

  if (state.kind === "wrong_account") {
    return (
      <>
        <AuthHeading title="Different account" subtitle="You're signed in with another email address." />
        <Notice tone="warning">{state.message}</Notice>
        <div className="mt-6">
          <Button onClick={signOut} loading={signingOut} loadingText="Signing out…">
            Sign out and continue
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Invitation unavailable" subtitle="We couldn't use this invitation link." />
      <Notice tone="danger">{state.message}</Notice>
      <div className="mt-6">
        <LinkButton href="/login" variant="secondary">
          Go to sign in
        </LinkButton>
      </div>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading invitation…" />}>
      <AcceptInvite />
    </Suspense>
  );
}
