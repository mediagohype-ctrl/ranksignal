"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { Button, Field, Input, Skeleton, SkeletonText, fieldDescribedBy } from "@/components/ui";
import { AuthHeading, EMAIL_RE, FormError, PasswordInput, passwordStrength, postJson, safeNext } from "../auth-ui";

const MIN_PASSWORD = 10;

type FormKey = "name" | "email" | "password" | "organizationName";

function validateForm(f: Record<FormKey, string>): Partial<Record<FormKey, string>> {
  const e: Partial<Record<FormKey, string>> = {};
  if (!f.name.trim()) e.name = "Tell us your name.";
  if (!f.email.trim()) e.email = "Enter your work email.";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "That doesn't look like an email address.";
  if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (!f.organizationName.trim()) e.organizationName = "Give your workspace a name — usually your company name.";
  return e;
}

const STRENGTH_TONE = ["bg-score-track", "bg-danger", "bg-warning", "bg-success"] as const;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/app/onboarding");
  const [form, setForm] = useState<Record<FormKey, string>>({ name: "", email: "", password: "", organizationName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setTouched({ name: true, email: true, password: true, organizationName: true });
    const firstBad = (Object.keys(v) as FormKey[])[0];
    if (firstBad) {
      document.getElementById(`su-${firstBad}`)?.focus();
      return;
    }
    setLoading(true);
    const res = await postJson("/api/auth/signup", { ...form, email: form.email.trim() });
    if (res.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setError(res.message ?? "Sign-up failed.");
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
            7 days free, no card needed. Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="su-name" error={errors.name}>
            <Input
              id="su-name"
              autoComplete="name"
              placeholder="Priya Shah"
              required
              autoFocus
              value={form.name}
              onChange={set("name")}
              onBlur={blur("name")}
              invalid={!!errors.name}
              aria-describedby={fieldDescribedBy("su-name", { error: errors.name })}
            />
          </Field>
          <Field label="Company name" htmlFor="su-organizationName" error={errors.organizationName}>
            <Input
              id="su-organizationName"
              autoComplete="organization"
              placeholder="Acme Tools"
              required
              value={form.organizationName}
              onChange={set("organizationName")}
              onBlur={blur("organizationName")}
              invalid={!!errors.organizationName}
              aria-describedby={fieldDescribedBy("su-organizationName", { error: errors.organizationName })}
            />
          </Field>
        </div>
        <Field label="Work email" htmlFor="su-email" error={errors.email}>
          <Input
            id="su-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
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
        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Creating your workspace…" iconRight={<ArrowRight />}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          We measure and report how AI assistants describe your brand. We never guarantee rankings or placements.
        </p>
      </form>
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading sign-up form" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <SkeletonText lines={1} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" rounded="lg" />
        <Skeleton className="h-10 w-full" rounded="lg" />
      </div>
      <Skeleton className="h-10 w-full" rounded="lg" />
      <Skeleton className="h-10 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
