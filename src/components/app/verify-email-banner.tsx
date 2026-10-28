"use client";
// Self-contained "Verify your email" banner. Mount once inside the app shell (client or server parent).
// Fetches GET /api/auth/me, renders nothing when verified/dismissed, offers a resend button.
import { useEffect, useState } from "react";
import { MailWarning, X } from "lucide-react";
import { Button, Notice } from "@/components/ui";

const DISMISS_KEY = "verify-email-banner-dismissed";

export function VerifyEmailBanner({ className }: { className?: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage unavailable: show the banner */
    }
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { item?: { user?: { email?: string; emailVerified?: boolean } } } | null) => {
        const u = d?.item?.user;
        if (alive && u && u.emailVerified === false && u.email) {
          setEmail(u.email);
          setDismissed(false);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function resend() {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST", credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { alreadyVerified?: boolean; error?: { message?: string } } | null;
      if (res.ok) {
        if (data?.alreadyVerified) {
          setDismissed(true);
          return;
        }
        setStatus("sent");
        setMessage(`We sent a new link to ${email}. It works for 24 hours.`);
      } else {
        setStatus("error");
        setMessage(data?.error?.message ?? "We couldn't send the email. Please try again later.");
      }
    } catch {
      setStatus("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  }

  if (dismissed || !email) return null;

  return (
    <div className={className} role="region" aria-label="Email verification">
      <Notice
        tone={status === "error" ? "danger" : status === "sent" ? "success" : "warning"}
        icon={<MailWarning />}
        title="Please confirm your email address"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={resend} loading={status === "sending"} loadingText="Sending…" disabled={status === "sent"}>
              {status === "sent" ? "Link sent" : "Resend link"}
            </Button>
            <Button size="sm" variant="ghost" icon={<X />} onClick={dismiss}>
              Dismiss
            </Button>
          </>
        }
      >
        {message ?? (
          <>
            We sent a confirmation link to <strong className="font-semibold text-fg">{email}</strong>. Confirming makes sure reports, alerts and
            password resets reach you.
          </>
        )}
      </Notice>
    </div>
  );
}
