"use client";
// Contact form → POST /api/public/contact. Honeypot + captcha; success state replaces the form.
// Labels come from contact-copy.ts in English or Hindi (`lang`), so /hi/contact shows a fully Hindi form.
import { useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, MessageCircle, Send } from "lucide-react";
import { Button, Field, Input, Notice, Textarea, fieldDescribedBy } from "@/components/ui";
import { Turnstile, isTurnstileConfigured } from "@/components/turnstile";
import { CONTACT_FORM_COPY, REPLY_TIME, customPrefill, servicesPrefill, type ContactLang } from "./contact-copy";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export function ContactForm({
  supportEmail,
  topic,
  tierName,
  lang = "en",
  whatsappHref,
  callViaForm = false,
}: {
  supportEmail: string;
  /** "services" pre-fills the message for the done-for-you call; "custom" for the Custom plan. */
  topic?: "services" | "custom";
  tierName?: string;
  lang?: ContactLang;
  /** WhatsApp chat link with a ready-typed message (built on the server); shown after the form is sent. */
  whatsappHref?: string;
  /** True while there is no booking calendar: the form itself is how to ask for a free call, and says so. */
  callViaForm?: boolean;
}) {
  const t = CONTACT_FORM_COPY[lang];
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: topic === "services" ? servicesPrefill(lang, tierName) : topic === "custom" ? customPrefill(lang) : "",
    website: "",
  });
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = t.errName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t.errEmail;
    if (form.message.trim().length < 10) e.message = t.errMessage;
    return e;
  };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    if (isTurnstileConfigured() && !token) {
      setFormError(t.errCaptcha);
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
      // The server's messages are in English; Hindi visitors get the Hindi fallback with the email address.
      setFormError(lang === "en" && data?.error?.message ? data.error.message : t.errServer(supportEmail));
    } catch {
      setFormError(t.errNetwork(supportEmail));
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
        <h2 className="mt-4 text-h3 text-fg">{t.sentTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-fg-soft">
          <strong className="font-semibold text-fg">{REPLY_TIME[lang]}</strong> {t.sentBody(form.email.trim())}
        </p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong px-5 text-small font-medium text-fg hover:bg-surface-2"
          >
            <MessageCircle aria-hidden size={16} className="text-success" />
            {t.whatsapp}
            <span className="sr-only"> {t.newTab}</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Notice tone="danger">{formError}</Notice>}
      {callViaForm && <p className="rounded-xl bg-primary-soft px-4 py-3 text-small font-medium text-primary-soft-fg">{t.callViaForm}</p>}
      {topic === "services" && (
        <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-small font-medium text-primary-soft-fg">
          {t.topicServices}
        </p>
      )}
      {topic === "custom" && (
        <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-small font-medium text-primary-soft-fg">
          {t.topicCustom}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.name} htmlFor="c-name" error={errors.name} required>
          <Input id="c-name" autoComplete="name" value={form.name} onChange={set("name")} maxLength={100} required invalid={!!errors.name}
            aria-describedby={fieldDescribedBy("c-name", { error: errors.name })} />
        </Field>
        <Field label={t.email} htmlFor="c-email" error={errors.email} required>
          <Input id="c-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} maxLength={254} required invalid={!!errors.email}
            aria-describedby={fieldDescribedBy("c-email", { error: errors.email })} />
        </Field>
      </div>
      <Field label={`${t.company}${t.optionalSuffix}`} htmlFor="c-company" optional={!t.optionalSuffix}>
        <Input id="c-company" autoComplete="organization" value={form.company} onChange={set("company")} maxLength={120} />
      </Field>
      <Field label={t.message} htmlFor="c-message" hint={topic === "services" ? t.hintServices : topic === "custom" ? t.hintCustom : t.hintDefault} error={errors.message} required>
        <Textarea id="c-message" rows={6} value={form.message} onChange={set("message")} maxLength={5000} required invalid={!!errors.message}
          aria-describedby={fieldDescribedBy("c-message", { hint: true, error: errors.message })} />
      </Field>
      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">{t.honeypot}</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Turnstile key={widgetKey} onToken={setToken} action="contact" />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" size="lg" icon={<Send />} loading={busy} loadingText={t.sending}>
          {t.send}
        </Button>
      </div>
    </form>
  );
}
