"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { Button, Field, Input, Notice, Skeleton, SkeletonText, fieldDescribedBy } from "@/components/ui";
import { AuthHeading, EMAIL_RE, FormError, postJson } from "../auth-ui";

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const addr = email.trim();
    if (!addr) return setFieldError("Enter your email address.");
    if (!EMAIL_RE.test(addr)) return setFieldError("That doesn't look like an email address.");
    setLoading(true);
    const res = await postJson("/api/auth/forgot-password", { email: addr });
    setLoading(false);
    if (res.ok) setSentTo(addr);
    else setError(res.message ?? "Something went wrong. Please try again.");
  }

  if (sentTo) {
    return (
      <>
        <AuthHeading title="Check your inbox" subtitle="If there's an account for that address, a reset link is on its way." />
        <Notice tone="success" icon={<MailCheck />} title="Reset link sent">
          We sent instructions to <strong className="font-semibold text-fg">{sentTo}</strong> if it belongs to an account. The link works for 60
          minutes. Don&apos;t see it? Check your spam folder.
        </Notice>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Link href="/login" className="inline-flex items-center gap-1.5 self-center text-small font-medium text-primary hover:underline">
            <ArrowLeft size={15} aria-hidden /> Back to sign in
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        subtitle="Enter the email you sign in with and we'll send you a link to choose a new password."
      />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <Field label="Email address" htmlFor="fp-email" error={fieldError}>
          <Input
            id="fp-email"
            type="email"
            inputSize="lg"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
            value={email}
            invalid={!!fieldError}
            aria-describedby={fieldDescribedBy("fp-email", { error: fieldError })}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldError) setFieldError(undefined);
            }}
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Sending…" icon={<Send />}>
          Send reset link
        </Button>
      </form>
      <p className="mt-8 text-center text-small text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <SkeletonText lines={2} />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ForgotForm />
    </Suspense>
  );
}
