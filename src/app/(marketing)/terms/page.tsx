import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JURISDICTION_CITY, LEGAL_ADDRESS, LEGAL_EMAIL, LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/site";
import { TRIAL_DAYS } from "@/components/marketing/plans";
import { LegalPage } from "@/components/marketing/legal";
import { JsonLd } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/terms");

const mail = <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <JsonLd data={webPageLd("/terms", { name: "Terms of Service" })} />
      <p>
        These terms are an agreement between you and {LEGAL_ENTITY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), which runs{" "}
        {BRAND.name}. By creating an account, starting a trial or using the free website check, you agree to them. If
        you use {BRAND.name} for a business, you confirm you are allowed to accept these terms for that business.
      </p>

      <h2>1. What {BRAND.name} does</h2>
      <p>
        {BRAND.name} checks your website, asks AI assistants such as ChatGPT and Gemini the questions your customers
        ask, shows you a score and a list of fixes, and — when you connect your website and give your OK — makes those
        fixes for you. We may add, change or remove features over time; if we remove something important from a paid
        plan, we will tell you first.
      </p>

      <h2>2. What we can&apos;t promise</h2>
      <p>
        Google and AI assistants are run by other companies, and their results change all the time. We do not
        promise any Google position, AI mention, link, visitors, leads or sales. Our scores and numbers are honest
        measurements of what we found at the time, based on a sample of answers — not a guarantee of what will happen
        next.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least 18 and give us true details.</li>
        <li>Keep your password safe. You are responsible for what happens in your account, including what your team members do.</li>
        <li>Tell us straight away at {mail} if you think someone else is using your account.</li>
      </ul>

      <h2>4. Your websites and your OK</h2>
      <ul>
        <li>Only add websites and connect services that you own or are allowed to manage.</li>
        <li>
          Changes to your website happen only after you (or someone on your team with permission) approve the exact
          draft, or if you turn on automatic small fixes. You are responsible for checking a draft before you approve
          it.
        </li>
        <li>We save the old version before a change so you can undo it, but please keep your own backups too.</li>
        <li>You can disconnect your website, or ask us to pause all changes, at any time.</li>
      </ul>

      <h2>5. Fair use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>check websites you have no right to check, or use {BRAND.name} to attack, overload or copy other websites;</li>
        <li>use it for anything illegal, misleading, or that breaks other people&apos;s rights;</li>
        <li>try to get around plan limits, security checks, or access other customers&apos; data;</li>
        <li>resell or copy the service without our written OK (the Agency plan allows managing client websites).</li>
      </ul>
      <p>If you break these rules, we may pause or close your account. Where we can, we will warn you first.</p>

      <h2>6. Free trial, plans and payments</h2>
      <ul>
        <li>New accounts get a {TRIAL_DAYS}-day free trial. You don&apos;t pay anything unless you choose a plan.</li>
        <li>Paid plans are billed monthly in advance, in Indian rupees, through Razorpay. Prices on our website do not include GST, which is added at the current rate.</li>
        <li>Your plan renews every month until you cancel. You can cancel any time in the app; you keep access until the end of the month you paid for.</li>
        <li>We don&apos;t refund part-months, except where the law requires it or we agree in writing.</li>
        <li>If a payment fails, we will remind you. If it is still unpaid after a short grace period, we may limit your account until it is paid.</li>
        <li>We may change prices with at least 30 days&apos; notice by email. The new price starts from your next renewal after that.</li>
        <li>Done-for-you services have their own written order (scope, price, minimum term); where it differs from these terms, the order wins.</li>
      </ul>

      <h2>7. Your content and ours</h2>
      <p>
        Your website, business details, questions and approved drafts stay yours. You let us use them only to run the
        service for you. The {BRAND.name} software, design and reports format belong to us. Drafts we write for you
        become yours once you approve them.
      </p>
      <p>
        How we handle personal information is explained in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>8. Other services</h2>
      <p>
        {BRAND.name} works with services run by others — AI assistants, Google, Razorpay, your website platform. Their
        own terms apply to them, and we are not responsible if they change, go down, or give wrong answers.
      </p>

      <h2>9. If something goes wrong</h2>
      <p>
        We work hard to keep {BRAND.name} running and accurate, but we provide it &ldquo;as is&rdquo;. As far as the
        law allows, we are not responsible for indirect losses such as lost profits, lost sales or lost data, and our
        total responsibility for any claim is limited to the amount you paid us in the 3 months before the claim.
        Nothing in these terms limits rights you have under Indian consumer law that cannot be limited.
      </p>

      <h2>10. Closing your account</h2>
      <p>
        You can stop using {BRAND.name} and close your account any time by cancelling your plan and emailing {mail}.
        We may close an account that breaks these terms or stays unpaid. After closing, we delete your data as
        explained in our Privacy Policy.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        If we change these terms, we will update the date at the top and, for important changes, email account owners
        at least 15 days before they start. If you keep using {BRAND.name} after that, the new terms apply.
      </p>

      <h2>12. Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. If we disagree about something, please write to us first and we
        will try to sort it out within 30 days. If we can&apos;t, the courts in {JURISDICTION_CITY}, India will decide.
      </p>

      <h2>13. Contact</h2>
      <p>
        {LEGAL_ENTITY}
        <br />
        {LEGAL_ADDRESS && (
          <>
            {LEGAL_ADDRESS}
            <br />
          </>
        )}
        Email: {mail}
      </p>
    </LegalPage>
  );
}
