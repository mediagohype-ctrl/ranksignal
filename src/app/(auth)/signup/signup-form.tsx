"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { Button, Field, Input, Skeleton, SkeletonText, fieldDescribedBy } from "@/components/ui";
import { Turnstile, isTurnstileConfigured } from "@/components/turnstile";
import { AuthHeading, EMAIL_RE, FormError, PasswordInput, inviteTokenFromNext, passwordStrength, postJson, safeNext } from "../auth-ui";
import { GoogleButton, OrDivider, googleErrorMessage, googleStartHref } from "../google-button";

const MIN_PASSWORD = 10;

type FormKey = "name" | "email" | "password";

function validateForm(f: Record<FormKey, string>): Partial<Record<FormKey, string>> {
  const e: Partial<Record<FormKey, string>> = {};
  if (!f.name.trim()) e.name = "Tell us your name.";
  if (!f.email.trim()) e.email = "Enter your email address.";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "That doesn't look like an email address. Check it and try again.";
  if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (f.email.trim() && f.password.trim().toLowerCase() === f.email.trim().toLowerCase())
    e.password = "Your password can't be your email address. Pick something else.";
  return e;
}

/** Referral codes (?ref=) are short URL-safe tokens; anything else is dropped. */
function safeRef(raw: string | null): string | null {
  return raw && /^[A-Za-z0-9_-]{3,64}$/.test(raw.trim()) ? raw.trim() : null;
}

/** Accepts only an absolute http(s) URL of at most 2048 chars; anything else is dropped. */
function safeWebsite(raw: string | null): string | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? raw.trim() : null;
  } catch {
    return null;
  }
}

const STRENGTH_TONE = ["bg-score-track", "bg-danger", "bg-warning", "bg-success"] as const;

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // Free-check visitors arrive with ?website=<url>; carry it into onboarding (an explicit ?next wins).
  const website = safeWebsite(params.get("website"));
  const next = safeNext(params.get("next"), website ? `/app/onboarding?website=${encodeURIComponent(website)}` : "/app/onboarding");
  // Arriving from an invitation (/accept-invite?token=…): the signed token lets the server create the invited account.
  const inviteToken = inviteTokenFromNext(next);
  // Referral links (?ref=) are carried to the sign-up API and through Google sign-in.
  const ref = safeRef(params.get("ref"));
  const [form, setForm] = useState<Record<FormKey, string>>({
    name: "",
    email: params.get("email") ?? "",
    password: "",
  });
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(googleErrorMessage(params.get("google_error")));
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FormKey, boolean>>>({});

  const set = (k: FormKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nf = { ...form, [k]: value };
    setForm(nf);
    if (touched[k] || errors[k]) setErrors((x) => ({ ...x, [k]: validateForm(nf)[k] }));
  };
  const blur = (k: FormKey) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    if (form[k]) setErrors((x) => ({ ...x, [k]: validateForm(form)[k] }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateForm(form);
    setErrors(v);
    setTouched({ name: true, email: true, password: true });
    const firstBad = (Object.keys(v) as FormKey[])[0];
    if (firstBad) {
      document.getElementById(`su-${firstBad}`)?.focus();
      return;
    }
    if (isTurnstileConfigured() && !captchaToken) {
      setError("Please complete the security check below, then try again.");
      return;
    }
    setLoading(true);
    const res = await postJson("/api/auth/signup", {
      ...form,
      email: form.email.trim().toLowerCase(),
      ...(captchaToken ? { turnstileToken: captchaToken } : {}),
      ...(inviteToken ? { inviteToken } : {}),
      ...(ref ? { ref } : {}),
    });
    if (res.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    // Turnstile tokens are single-use: get a fresh one for the next attempt.
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
    setError(res.message ?? "We couldn't create your account. Please try again, or contact us if it keeps happening.");
    const fe = res.fieldErrors ?? {};
    setErrors(Object.fromEntries(Object.entries(fe).map(([k, msgs]) => [k, msgs[0]])) as Partial<Record<FormKey, string>>);
    setLoading(false);
  }

  const strength = passwordStrength(form.password);
  const pwHint = form.password ? `Strength: ${strength.label}` : `At least ${MIN_PASSWORD} characters. A short phrase works well.`;

  return (
    <>
      <AuthHeading
        title="Start your free trial"
        subtitle={
          <>
            7 days free, no card needed. We&apos;ll check your website and ask ChatGPT, Gemini and others what they
            say about you. Already have an account?{" "}
            <Link href={`/login${next !== "/app/onboarding" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      {googleEnabled && !inviteToken && (
        <>
          <GoogleButton href={googleStartHref({ next, ref, from: "signup" })} />
          <OrDivider />
        </>
      )}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <Field label="Your name" htmlFor="su-name" error={errors.name}>
          <Input
            id="su-name"
            autoComplete="name"
            placeholder="Priya Shah"
            required
            value={form.name}
            onChange={set("name")}
            onBlur={blur("name")}
            invalid={!!errors.name}
            aria-describedby={fieldDescribedBy("su-name", { error: errors.name })}
          />
        </Field>
        <Field label="Email" htmlFor="su-email" error={errors.email}>
          <Input
            id="su-email"
            type="email"
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            required
            value={form.email}
            onChange={set("email")}
            onBlur={blur("email")}
            invalid={!!errors.email}
            aria-describedby={fieldDescribedBy("su-email", { error: errors.email })}
          />
        </Field>
        <Field label="Password" htmlFor="su-password" error={errors.password} hint={pwHint}>
          <PasswordInput
            id="su-password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={form.password}
            onChange={set("password")}
            onBlur={blur("password")}
            invalid={!!errors.password}
            aria-describedby={fieldDescribedBy("su-password", { hint: pwHint, error: errors.password })}
          />
          <div aria-hidden className="flex gap-1.5 pt-0.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={clsx(
                  "h-1 flex-1 rounded-full transition-colors",
                  strength.score >= i ? STRENGTH_TONE[strength.score] : "bg-score-track",
                )}
              />
            ))}
          </div>
        </Field>
        <Turnstile key={captchaKey} action="signup" onToken={setCaptchaToken} />
        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Creating your account…" iconRight={<ArrowRight />}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          We show you how Google and AI assistants see your business. Nobody can promise a Google position or an AI mention.
        </p>
      </form>
    </>
  );
}

export function SignupFormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading sign-up form" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <SkeletonText lines={1} />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-10 w-full" rounded="lg" />
      <Skeleton className="h-10 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
    </div>
  );
}
