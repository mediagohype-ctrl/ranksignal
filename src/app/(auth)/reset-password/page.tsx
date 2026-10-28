"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { KeyRound } from "lucide-react";
import { Button, Field, LinkButton, Notice, Skeleton, SkeletonText, fieldDescribedBy } from "@/components/ui";
import { AuthHeading, FormError, PasswordInput, passwordStrength, postJson } from "../auth-ui";

const MIN_PASSWORD = 10;
const STRENGTH_TONE = ["bg-score-track", "bg-danger", "bg-warning", "bg-success"] as const;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(!token);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v: typeof errors = {};
    if (password.length < MIN_PASSWORD) v.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) v.confirm = "The two passwords don't match.";
    setErrors(v);
    if (v.password || v.confirm) {
      document.getElementById(v.password ? "rp-password" : "rp-confirm")?.focus();
      return;
    }
    setLoading(true);
    const res = await postJson("/api/auth/reset-password", { token, password });
    if (res.ok) {
      router.replace("/login?reset=1");
      return;
    }
    setLoading(false);
    if (res.code === "invalid_token") {
      setInvalidLink(true);
      return;
    }
    const fe = res.fieldErrors?.password?.[0];
    if (fe) setErrors({ password: fe });
    else setError(res.message ?? "Something went wrong. Please try again.");
  }

  if (invalidLink) {
    return (
      <>
        <AuthHeading title="This link has expired" subtitle="Reset links work for 60 minutes and only once." />
        <Notice tone="warning" title="Request a new link">
          This password reset link is invalid, has expired or has already been used. Ask for a fresh one and use it within the hour.
        </Notice>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <LinkButton href="/forgot-password">Send a new link</LinkButton>
          <Link href="/login" className="text-small font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  const strength = passwordStrength(password);
  const pwHint = password ? `Strength: ${strength.label}` : `At least ${MIN_PASSWORD} characters. A short phrase works well.`;

  return (
    <>
      <AuthHeading title="Choose a new password" subtitle="Pick something you don't use on other websites." />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <Field label="New password" htmlFor="rp-password" error={errors.password} hint={pwHint}>
          <PasswordInput
            id="rp-password"
            inputSize="lg"
            autoComplete="new-password"
            autoFocus
            required
            minLength={MIN_PASSWORD}
            value={password}
            invalid={!!errors.password}
            aria-describedby={fieldDescribedBy("rp-password", { hint: pwHint, error: errors.password })}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            }}
          />
          <div aria-hidden className="flex gap-1.5 pt-0.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={clsx("h-1 flex-1 rounded-full transition-colors", strength.score >= i ? STRENGTH_TONE[strength.score] : "bg-score-track")}
              />
            ))}
          </div>
        </Field>
        <Field label="Confirm new password" htmlFor="rp-confirm" error={errors.confirm}>
          <PasswordInput
            id="rp-confirm"
            inputSize="lg"
            autoComplete="new-password"
            required
            value={confirm}
            invalid={!!errors.confirm}
            aria-describedby={fieldDescribedBy("rp-confirm", { error: errors.confirm })}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined }));
            }}
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Saving…" icon={<KeyRound />}>
          Save new password
        </Button>
      </form>
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <SkeletonText lines={1} />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ResetForm />
    </Suspense>
  );
}
