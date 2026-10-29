"use client";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, Notice, type InputProps } from "@/components/ui";

export { inviteTokenFromNext, safeNext } from "./safe-next";

export interface PostJsonResult<T = unknown> {
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  data?: T;
}

export async function postJson<T = unknown>(url: string, body: unknown): Promise<PostJsonResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string; details?: Record<string, unknown> & { fieldErrors?: Record<string, string[]> } } })
      | null;
    if (res.ok) return { ok: true, status: res.status, data: (data ?? undefined) as T | undefined };
    return {
      ok: false,
      status: res.status,
      code: data?.error?.code,
      message: data?.error?.message ?? (res.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Something went wrong. Please try again."),
      fieldErrors: data?.error?.details?.fieldErrors,
      details: data?.error?.details,
    };
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Page heading block shown above the auth form. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-h2 text-fg">{title}</h1>
      <p className="mt-2 text-body text-muted">{subtitle}</p>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Notice tone="danger" className="animate-fade-in">
      {message}
    </Notice>
  );
}

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} ref={ref} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-fg"
      >
        {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
});

/** Simple, explainable strength hint (length + variety). */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  if (pw.length < 10) return { score: 1, label: "Too short" };
  if (pw.length >= 14 && variety >= 3) return { score: 3, label: "Strong" };
  if (variety >= 2) return { score: 2, label: "Good" };
  return { score: 1, label: "Weak — mix letters, numbers or symbols" };
}
