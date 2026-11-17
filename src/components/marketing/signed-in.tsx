"use client";
// Signed-in visitors see "Open app" instead of "Log in" in the website header and footer.
// The marketing pages are static (served from cache), so the server cannot read the session cookie for them.
// The browser asks GET /api/auth/signed-in once per page load (shared by header and footer) and swaps the link.
import { useEffect, useState } from "react";
import Link from "next/link";

let pending: Promise<boolean> | null = null;

/** One request per page load, shared by every caller. Any failure counts as "not signed in". */
export function fetchSignedIn(): Promise<boolean> {
  pending ??= fetch("/api/auth/signed-in", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { signedIn?: unknown } | null) => d?.signedIn === true)
    .catch(() => false);
  return pending;
}

/** False on the server and on first paint (so the cached HTML is the same for everyone), then the real answer. */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchSignedIn().then((v) => {
      if (live) setSignedIn(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return signedIn;
}

/** "Log in" link that becomes "Open app" for signed-in visitors. */
export function AccountLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? "/app" : "/login"} onClick={onClick} className={className}>
      {signedIn ? "Open app" : "Log in"}
    </Link>
  );
}
