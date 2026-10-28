"use client";
// Contact form → POST /api/public/contact. Honeypot + captcha; success state replaces the form.
import { useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button, Field, Input, Notice, Textarea, fieldDescribedBy } from "@/components/ui";
import { Turnstile, isTurnstileConfigured } from "@/components/turnstile";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "", website: "" });
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Please tell us your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) e.message = "Please write a little more (at least 10 characters).";
    return e;
  };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    if (isTurnstileConfigured() && !token) {
      setFormError("Please complete the security check.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: token || undefined }),
      });
      if (res.ok) {
        setSent(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setFormError(data?.error?.message ?? `Something went wrong. Please email ${supportEmail} instead.`);
    } catch {
      setFormError(`We couldn't reach our server. Please email ${supportEmail} instead.`);
    } finally {
      setBusy(false);
      setToken("");
      setWidgetKey((k) => k + 1);
    }
  }

  if (sent) {
    return (
      <div role="status" className="animate-fade-in py-6 text-center">
        <CheckCircle2 aria-hidden size={40} className="mx-auto text-success" />
        <h2 className="mt-4 text-h3 text-fg">Thanks — your message is on its way</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-fg-soft">
          We usually reply within one business day to <strong className="font-semibold text-fg">{form.email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Notice tone="danger">{formError}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" error={errors.name} required>
          <Input id="c-name" autoComplete="name" value={form.name} onChange={set("name")} maxLength={100} required invalid={!!errors.name}
            aria-describedby={fieldDescribedBy("c-name", { error: errors.name })} />
        </Field>
        <Field label="Work email" htmlFor="c-email" error={errors.email} required>
          <Input id="c-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} maxLength={254} required invalid={!!errors.email}
            aria-describedby={fieldDescribedBy("c-email", { error: errors.email })} />
        </Field>
      </div>
      <Field label="Company or agency" htmlFor="c-company" optional>
        <Input id="c-company" autoComplete="organization" value={form.company} onChange={set("company")} maxLength={120} />
      </Field>
      <Field label="How can we help?" htmlFor="c-message" hint="E.g. how many client sites you manage, or what you'd like to know." error={errors.message} required>
        <Textarea id="c-message" rows={6} value={form.message} onChange={set("message")} maxLength={5000} required invalid={!!errors.message}
          aria-describedby={fieldDescribedBy("c-message", { hint: true, error: errors.message })} />
      </Field>
      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Leave this empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Turnstile key={widgetKey} onToken={setToken} action="contact" />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" size="lg" icon={<Send />} loading={busy} loadingText="Sending…">
          Send message
        </Button>
      </div>
    </form>
  );
}
