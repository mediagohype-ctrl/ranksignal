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
  // Roles are capitalised on customer screens: "Owner", "Admin", "Member".
  const role = o.role ? o.role.charAt(0).toUpperCase() + o.role.slice(1).toLowerCase() : "Member";
  return {
    subject: subject.slice(0, 200),
    ...renderEmail({
      title: `Join ${o.organizationName} on ${BRAND.name}`,
      preheader: `${o.inviterName} invited you as ${role}.`,
      paragraphs: [
        `${o.inviterName} invited you to join the ${o.organizationName} team as ${/^[aeiou]/i.test(role) ? "an" : "a"} ${role}.`,
        `${BRAND.name} checks how Google and AI assistants like ChatGPT describe a business, and suggests fixes. Accept the invitation to see this workspace. The link works for 7 days.`,
      ],
      cta: { label: "Accept invitation", url: o.link },
      footer: "If you weren't expecting this invitation, you can ignore this email.",
    }),
  };
}

// ---- Growth emails (brief §9). One button each; plain words (docs/PLAIN_WORDS.md). ---------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const GROWTH_FOOTER = `You're getting this because you own a ${BRAND.name} account. To stop project emails, open Project settings → Notifications.`;

/** Trial day 1: the top fix from the stored report. Button → To-do. */
export function trialDay1Template(o: { orgName: string; fixTitle: string | null; fixWhy: string | null; link: string }): EmailContent {
  const subject = o.fixTitle ? `Your first fix: ${o.fixTitle}`.slice(0, 200) : "Your first fixes are ready";
  return {
    subject,
    ...renderEmail({
      title: "Your first fix",
      preheader: o.fixTitle ?? "We checked your website. Here's where to start.",
      paragraphs: [
        "Hi,",
        o.fixTitle
          ? `We checked your website. The one thing to fix first is: ${o.fixTitle}.`
          : "We checked your website and listed the fixes that help most, easiest first.",
        ...(o.fixWhy ? [o.fixWhy] : []),
        "It usually takes a few minutes. Your To-do list shows each step.",
      ],
      cta: { label: "Start fixing", url: o.link },
      footer: GROWTH_FOOTER,
    }),
  };
}

/** Trial day 3: "AI named you in X of Y answers". Button → AI answers. */
export function trialDay3Template(o: { orgName: string; named: number | null; total: number | null; link: string }): EmailContent {
  const measured = o.named !== null && o.total !== null && o.total > 0;
  const line = measured
    ? `We asked ChatGPT and other AI tools the questions your customers ask. AI named you in ${o.named} of ${plural(o.total!, "answer", "answers")}.`
    : "We can ask ChatGPT and other AI tools the questions your customers ask, and show you who they name.";
  return {
    subject: measured ? `AI answers are in: named in ${o.named} of ${o.total}` : "See what AI says about your business",
    ...renderEmail({
      title: "AI answers are in",
      preheader: line,
      paragraphs: [
        "Hi,",
        line,
        measured && o.named! < o.total! ? "See which businesses AI names instead of you, and what to change so it names you more often." : "See the answers word for word.",
      ],
      cta: { label: "See what AI says", url: o.link },
      footer: GROWTH_FOOTER,
    }),
  };
}

/** Trial day 6: trial ends tomorrow. Button → plans. */
export function trialDay6Template(o: { orgName: string; score: number | null; link: string }): EmailContent {
  return {
    subject: "Your trial ends tomorrow. Keep your weekly checks",
    ...renderEmail({
      title: "Your trial ends tomorrow",
      preheader: "Choose a plan to keep your weekly website and AI checks.",
      paragraphs: [
        "Hi,",
        o.score !== null
          ? `Your score is ${Math.round(o.score)} out of 100. Your free trial ends tomorrow.`
          : "Your free trial ends tomorrow.",
        "Choose a plan to keep checking your website every week, see what AI says about you, and keep your fixes and history.",
      ],
      cta: { label: "Choose a plan", url: o.link },
      footer: GROWTH_FOOTER,
    }),
  };
}

/** Monday "fix of the week": one easy fix. Button → To-do. */
export function fixOfWeekTemplate(o: { projectName: string; fixTitle: string; whyItMatters: string | null; firstStep: string | null; link: string }): EmailContent {
  return {
    subject: `Fix of the week: ${o.fixTitle}`.slice(0, 200),
    ...renderEmail({
      title: "Your fix of the week",
      preheader: `One easy fix for ${o.projectName}.`,
      paragraphs: [
        "Hi,",
        `Here's one easy fix for ${o.projectName} this week: ${o.fixTitle}.`,
        ...(o.whyItMatters ? [o.whyItMatters] : []),
        ...(o.firstStep ? [`First step: ${o.firstStep}`] : []),
      ],
      cta: { label: "Fix it now", url: o.link },
      footer: GROWTH_FOOTER,
    }),
  };
}

/** A competitor is newly named by AI for a customer question. Button → AI answers. */
export function competitorAlertTemplate(o: { projectName: string; items: { competitor: string; question: string }[]; link: string }): EmailContent {
  const first = o.items[0]!;
  const more = o.items.length - 1;
  const lines = o.items.slice(0, 5).map((i) => `${i.competitor} is now named for “${i.question}”.`);
  if (o.items.length > 5) lines.push(`…and ${plural(o.items.length - 5, "more change", "more changes")}.`);
  return {
    subject: `${first.competitor} is now named for “${first.question}”${more > 0 ? ` (+${more} more)` : ""}`.slice(0, 200),
    ...renderEmail({
      title: "A competitor is now named by AI",
      preheader: `In the latest AI check for ${o.projectName}.`,
      paragraphs: [
        "Hi,",
        `In the latest AI check for ${o.projectName}, AI tools started naming a business they didn't name last time:`,
        ...lines,
        "See the answers and what you can change so AI names you too.",
      ],
      cta: { label: "See what AI says", url: o.link },
      footer: GROWTH_FOOTER,
    }),
  };
}

/** Referral reward: a referred business started paying. Button → billing. */
export function referralRewardTemplate(o: { referredName: string; trialExtended: boolean; link: string }): EmailContent {
  return {
    subject: "You earned a free month",
    ...renderEmail({
      title: "You earned a free month",
      preheader: `${o.referredName} joined with your link.`,
      paragraphs: [
        "Hi,",
        `Thank you! ${o.referredName} joined ${BRAND.name} with your link and is now a paying customer.`,
        o.trialExtended
          ? "We added 30 more days to your free trial."
          : "We'll take one month off your next bill. You don't need to do anything.",
      ],
      cta: { label: "See your plan", url: o.link },
    }),
  };
}
