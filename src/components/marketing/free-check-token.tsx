"use client";
// Runs the security check (Turnstile) invisibly while the visitor types on the homepage. On submit the token is
// handed to /free-check, so the check starts the moment that page opens: one tap, no captcha box, no second form.
// The form itself stays a plain GET to /free-check?url=… (works without JavaScript; then /free-check gets a token).
import { useEffect, useRef } from "react";
import { Turnstile, storeTokenHandoff } from "@/components/turnstile";

export function FreeCheckTokenPrefetch() {
  const ref = useRef<HTMLSpanElement>(null);
  const token = useRef("");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onSubmit = () => {
      const url = (form.elements.namedItem("url") as HTMLInputElement | null)?.value ?? "";
      if (token.current && url.trim()) storeTokenHandoff(token.current, url);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <span ref={ref} className="block">
      <Turnstile invisible action="free_check" onToken={(t) => (token.current = t)} className="mt-2 flex justify-center empty:hidden" />
    </span>
  );
}
