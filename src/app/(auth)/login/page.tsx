"use client";
import { Suspense, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Field, Input, Notice, Skeleton, SkeletonText, fieldDescribedBy } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";
import { AuthHeading, EMAIL_RE, FormError, PasswordInput, postJson, safeNext } from "../auth-ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/app");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(
    params.get("verify_error") ? "That verification link is invalid or has expired. Sign in and we'll send a new one." : null,
  );
  const [notice] = useState<string | null>(
    params.get("reset") ? "Your password has been changed. Sign in with your new password." : params.get("deleted") ? "Your account has been deleted." : null,
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "That doesn't look like an email address.";
    if (!password) e.password = "Enter your password.";
    setErrors(e);
    if (e.email) emailRef.current?.focus();
    else if (e.password) passwordRef.current?.focus();
    return !e.email && !e.password;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    const res = await postJson("/api/auth/login", {
      email: email.trim(),
      password,
      ...(captchaToken ? { turnstileToken: captchaToken } : {}),
    });
    if (res.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    if (res.details?.captchaRequired) {
      setCaptchaRequired(true);
      // Turnstile tokens are single-use: remount the widget for a fresh one.
      setCaptchaToken("");
      setCaptchaKey((k) => k + 1);
    }
    setError(res.status === 401 ? "That email and password don't match. Please try again." : (res.message ?? "Sign-in failed."));
    setLoading(false);
  }

  const signupHref = `/signup${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <>
      <AuthHeading
        title="Welcome back"
        subtitle={
          <>
            New here?{" "}
            <Link href={signupHref} className="font-medium text-primary hover:underline">
              Start a 7-day free trial
            </Link>
          </>
        }
      />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {notice && !error && (
          <Notice tone="success" className="animate-fade-in">
            {notice}
          </Notice>
        )}
        <FormError message={error} />
        <Field label="Work email" htmlFor="login-email" error={errors.email}>
          <Input
            ref={emailRef}
            id="login-email"
            type="email"
            inputSize="lg"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
            value={email}
            invalid={!!errors.email}
            aria-describedby={fieldDescribedBy("login-email", { error: errors.email })}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
            }}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="login-password"
          error={errors.password}
          labelAside={
            <Link
              href={`/forgot-password${EMAIL_RE.test(email.trim()) ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            ref={passwordRef}
            id="login-password"
            inputSize="lg"
            autoComplete="current-password"
            required
            value={password}
            invalid={!!errors.password}
            aria-describedby={fieldDescribedBy("login-password", { error: errors.password })}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            }}
          />
        </Field>
        {captchaRequired && <Turnstile key={captchaKey} action="login" onToken={setCaptchaToken} />}
        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Signing in…" iconRight={<ArrowRight />}>
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-center text-xs text-muted">
        Trouble signing in?{" "}
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Reset your password
        </Link>
        , ask your workspace owner to re-invite you, or contact support.
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading sign-in form" className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <SkeletonText lines={1} />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="lg" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
