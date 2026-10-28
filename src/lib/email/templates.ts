// Account email templates (accounts agent). All built with renderEmail, which escapes every value.
import { BRAND } from "@/lib/brand";
import { renderEmail } from "./layout";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function appLink(path: string): string {
  return new URL(path, BRAND.appUrl).toString();
}

export function verifyEmailTemplate(o: { name?: string | null; link: string }): EmailContent {
  const subject = `Confirm your email for ${BRAND.name}`;
  return {
    subject,
    ...renderEmail({
      title: "Confirm your email address",
      preheader: "One click to confirm your email.",
      paragraphs: [
        o.name ? `Hi ${o.name},` : "Hi,",
        `Please confirm this is your email address so we can send you reports, alerts and account notices. The link works for 24 hours.`,
      ],
      cta: { label: "Confirm email", url: o.link },
      footer: `If you didn't create a ${BRAND.name} account, you can ignore this email.`,
    }),
  };
}

export function passwordResetTemplate(o: { name?: string | null; link: string }): EmailContent {
  const subject = `Reset your ${BRAND.name} password`;
  return {
    subject,
    ...renderEmail({
      title: "Reset your password",
      preheader: "This link works for 60 minutes and can be used once.",
      paragraphs: [
        o.name ? `Hi ${o.name},` : "Hi,",
        "We received a request to reset your password. Use the button below to choose a new one. The link works for 60 minutes and stops working once your password is changed.",
        "If you didn't ask for this, you can safely ignore this email — your password won't change.",
      ],
      cta: { label: "Choose a new password", url: o.link },
    }),
  };
}

export function passwordChangedTemplate(o: { name?: string | null }): EmailContent {
  const subject = `Your ${BRAND.name} password was changed`;
  return {
    subject,
    ...renderEmail({
      title: "Your password was changed",
      preheader: "If this wasn't you, reset your password now.",
      paragraphs: [
        o.name ? `Hi ${o.name},` : "Hi,",
        `The password for your ${BRAND.name} account was just changed.`,
        `If this wasn't you, reset your password straight away and contact us at ${BRAND.supportEmail}.`,
      ],
      cta: { label: "Reset password", url: appLink("/forgot-password") },
    }),
  };
}

export function inviteTemplate(o: { inviterName: string; organizationName: string; role: string; link: string }): EmailContent {
  const subject = `${o.inviterName} invited you to ${o.organizationName} on ${BRAND.name}`;
  return {
    subject: subject.slice(0, 200),
    ...renderEmail({
      title: `Join ${o.organizationName} on ${BRAND.name}`,
      preheader: `${o.inviterName} invited you as ${o.role}.`,
      paragraphs: [
        `${o.inviterName} invited you to join the ${o.organizationName} workspace as ${o.role === "admin" ? "an" : "a"} ${o.role}.`,
        `${BRAND.name} shows how AI assistants and search engines describe a business, and suggests fixes. Accept the invitation to see this workspace. The link works for 7 days.`,
      ],
      cta: { label: "Accept invitation", url: o.link },
      footer: "If you weren't expecting this invitation, you can ignore this email.",
    }),
  };
}
