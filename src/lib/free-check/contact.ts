// Public contact form: validation schema + support-inbox email (built with the shared renderEmail, which escapes input).
import { z } from "zod";
import { renderEmail } from "@/lib/email/layout";

const oneLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[\r\n\t]+/g, " "));

export const contactSchema = z.object({
  name: oneLine(100).pipe(z.string().min(1, "Please tell us your name.")),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  company: oneLine(120).optional().default(""),
  message: z.string().trim().min(10, "Please write a little more (at least 10 characters).").max(5000),
  turnstileToken: z.string().max(4096).optional(),
  /** Honeypot: hidden from people, often filled by bots. */
  website: z.string().max(500).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export function contactEmail(input: ContactInput, meta: { ip: string; at: Date }) {
  const subject = `Contact form: ${input.name}${input.company ? ` (${input.company})` : ""}`.slice(0, 150);
  const { html, text } = renderEmail({
    title: "New message from the website contact form",
    preheader: `${input.name} wrote in via the contact form`,
    paragraphs: [
      `From: ${input.name} <${input.email}>`,
      `Company: ${input.company || "—"}`,
      ...input.message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(0, 50),
      `Sent ${meta.at.toISOString()} · IP ${meta.ip}. Reply to this email to answer the sender directly.`,
    ],
  });
  return { subject, html, text };
}
