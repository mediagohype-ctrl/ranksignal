// "Continue with Google" — a plain link to /api/auth/google/start (a full-page navigation, so Google's redirect
// back sets the session cookie). Rendered only when GOOGLE_CLIENT_ID is configured on the server.

/** Builds the start URL, carrying `next`, the free-check `website` and a referral `ref` when present. */
export function googleStartHref(o: { next?: string | null; website?: string | null; ref?: string | null; from?: "login" | "signup" }): string {
  const q = new URLSearchParams();
  if (o.next) q.set("next", o.next);
  if (o.website) q.set("website", o.website);
  if (o.ref) q.set("ref", o.ref);
  if (o.from === "signup") q.set("from", "signup");
  const s = q.toString();
  return `/api/auth/google/start${s ? `?${s}` : ""}`;
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ href, label = "Continue with Google" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border-strong bg-surface px-4 text-body font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <GoogleMark />
      {label}
    </a>
  );
}

/** "or" rule between the Google button and the email form. */
export function OrDivider({ label = "or use your email" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Plain-words messages for /login?google_error=… (set by the Google callback). */
export const GOOGLE_ERRORS: Record<string, string> = {
  not_configured: "Google sign-in isn't available right now. Use your email and password instead.",
  access_denied: "Google sign-in was cancelled. Try again, or use your email instead.",
  invalid_state: "That Google sign-in link expired. Please click “Continue with Google” again.",
  email_unverified: "Your Google account's email isn't confirmed yet. Confirm it with Google, or sign up with your email.",
  google_mismatch: "This email is already linked to a different Google account. Sign in with that Google account or your password.",
  disposable_email: "Please use a permanent email address — temporary inboxes can't receive your reports.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
  try_again: "Something went wrong signing you in with Google. Please try again.",
  google_error: "We couldn't sign you in with Google. Please try again, or contact us if it keeps happening.",
};

export function googleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.google_error;
}
