import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { GRIEVANCE_OFFICER, LEGAL_ADDRESS, LEGAL_EMAIL, LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/site";
import { LegalPage } from "@/components/marketing/legal";
import { JsonLd } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/privacy");

const mail = <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <JsonLd data={webPageLd("/privacy", { name: "Privacy Policy" })} />
      <p>
        {BRAND.name} is run by {LEGAL_ENTITY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains, in plain
        words, what information we collect when you use our website and app, why we collect it, who we share it with,
        how long we keep it, and what you can ask us to do with it. It applies to {BRAND.name}&apos;s website, the free
        website check, the app, and our emails and WhatsApp messages.
      </p>
      <p>
        We follow India&apos;s Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) and the Information
        Technology Act, 2000 and its rules. Under the DPDP Act, we are the &ldquo;data fiduciary&rdquo; for your
        account information.
      </p>

      <h2>1. What we collect</h2>
      <h3>Your account</h3>
      <ul>
        <li>Your name, email address and password (we store only a scrambled version of the password, never the password itself).</li>
        <li>Your business name, the people you invite to your team, and their roles.</li>
        <li>If you sign in with Google: your Google account email and name.</li>
        <li>Settings you choose, like your time zone and which emails you want.</li>
        <li>If you turn on WhatsApp updates: your WhatsApp number.</li>
      </ul>
      <h3>Your websites and checks</h3>
      <ul>
        <li>The website addresses you add, your business and brand names, competitors, country and language.</li>
        <li>The customer questions you add or that we suggest for you.</li>
        <li>
          What we find when we check your website: the public pages we read, scores, problems and fixes. We read only
          pages anyone can see on the internet, and we follow your site&apos;s robot rules file.
        </li>
        <li>The answers AI assistants give to your customer questions, which we save so you can read them.</li>
        <li>Drafts, approvals, changes made to your website, and the saved old versions used for undo.</li>
      </ul>
      <h3>Connected services</h3>
      <ul>
        <li>
          If you connect your website (for example WordPress, Shopify, Wix or GitHub) or Google Search Console and
          Google Analytics, we store the access key or login token needed to do what you approve. These are stored
          encrypted, and we never show them back to anyone.
        </li>
        <li>From Google Search Console and Google Analytics we read summary numbers about your website, such as searches and visits.</li>
      </ul>
      <h3>The free website check</h3>
      <ul>
        <li>The website address you type, the score we work out, and a scrambled code made from your internet (IP) address so we can stop misuse. We do not store your IP address itself.</li>
        <li>Your email address, only if you choose to give it to get your result.</li>
        <li>We do not store the pages we read during a free check.</li>
      </ul>
      <h3>Payments</h3>
      <ul>
        <li>
          Payments are handled by Razorpay. We receive your plan, payment status, invoice details and a Razorpay
          customer reference. We never see or store your full card number, UPI PIN or bank login.
        </li>
      </ul>
      <h3>Messages and contact</h3>
      <ul>
        <li>Messages you send us through the contact form or by email.</li>
      </ul>
      <h3>Security and usage</h3>
      <ul>
        <li>Sign-in records, a log of important actions in your account (like approvals and published changes), and basic technical logs (browser type, time, errors) that help us keep the service safe and working.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To run the service you signed up for: check your website, ask AI assistants your customer questions, show your scores and fixes, and make the changes you approve.</li>
        <li>To keep your account safe, stop abuse and fix problems.</li>
        <li>To bill you and keep the records the law asks for (for example GST invoices).</li>
        <li>To send you emails and, if you turned them on, WhatsApp messages about your account: check results, fixes waiting for your OK, monthly reports, trial reminders, and important notices.</li>
        <li>If you gave your email on the free check: to send your result and a short follow-up. You can say stop any time.</li>
        <li>To improve {BRAND.name}, using totals and patterns rather than looking at your business one by one.</li>
      </ul>
      <p>
        We use your information because you agreed to it when you signed up or gave it to us, because we need it to
        provide the service you asked for, or because the law requires it. We do not sell your personal information,
        and we do not use it for advertising.
      </p>

      <h2>3. Who we share it with</h2>
      <p>We share information only with companies that help us run {BRAND.name}, and only what they need:</p>
      <ul>
        <li>
          <strong>AI providers</strong> — OpenAI (ChatGPT), Google (Gemini), Anthropic (Claude), xAI (Grok), Perplexity,
          OpenRouter (which passes our requests to these AI providers), and data providers such as DataForSEO. We send them your customer questions, and sometimes your business name, website address and the
          text of your public pages, so they can answer the questions or help write drafts. We do not send your
          password, payment details or your team&apos;s personal details. These providers have their own privacy
          rules. We use their business (paid API) services and, where they offer the choice, settings that stop our
          requests being used to train their models.
        </li>
        <li><strong>Payments</strong> — Razorpay, to take payments and manage subscriptions.</li>
        <li><strong>Hosting and database</strong> — the cloud companies that host our app and store our data.</li>
        <li><strong>Email</strong> — our email sending service, to deliver account and report emails.</li>
        <li><strong>WhatsApp</strong> — our WhatsApp messaging provider, only if you turned on WhatsApp updates.</li>
        <li><strong>Security check</strong> — Cloudflare Turnstile, which checks that forms are filled in by a person, not a robot.</li>
        <li><strong>Services you connect</strong> — your website platform or Google, only to do what you asked.</li>
      </ul>
      <p>
        Some of these companies store data outside India. When they do, we use providers that protect it with
        security and contract terms at least as strong as this policy, and we follow any limits the Government of
        India sets on sending data abroad.
      </p>
      <p>
        We may also share information if the law requires it, to protect people from harm, or if our business is
        sold or merged (in which case this policy keeps applying to your information).
      </p>
      <p>
        <strong>Staff access.</strong> Our support staff can look at your account only to help you or to fix a
        problem. Every time they do, it is recorded in your account&apos;s activity log.
      </p>

      <h2>4. Cookies</h2>
      <p>
        We use a small number of cookies that the site needs to work: one keeps you signed in, and others protect
        forms from misuse. We do not use advertising cookies or cookies that track you across other websites. If you
        block cookies, you will not be able to sign in.
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li><strong>Your account and websites:</strong> while your account is open. After you close it, we delete or anonymise it within 90 days.</li>
        <li><strong>Check results and saved AI answers:</strong> while your account is open, so you can see your score history.</li>
        <li><strong>Free-check records</strong> (website, score, email if given): up to 12 months, or sooner if you ask.</li>
        <li><strong>Payment and invoice records:</strong> 8 years, because Indian tax law requires it.</li>
        <li><strong>Security and activity logs:</strong> up to 2 years.</li>
        <li><strong>Backups:</strong> deleted data can stay in encrypted backups for up to 35 days before it is overwritten.</li>
      </ul>

      <h2>6. Keeping it safe</h2>
      <p>
        We use encrypted connections (https), store passwords and access keys in scrambled or encrypted form, limit
        who on our team can see data, and keep an activity log of important actions. No system is perfectly safe; if
        a data breach affects you, we will tell you and the Data Protection Board of India as the law requires.
      </p>

      <h2>7. Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal information we hold about you and who we shared it with;</li>
        <li>correct or update it;</li>
        <li>delete it (we will delete it unless the law says we must keep it, for example invoices);</li>
        <li>stop using it where you gave consent — for example, stop marketing emails or WhatsApp messages;</li>
        <li>name someone to act for you if you die or cannot act yourself.</li>
      </ul>
      <p>
        To do any of this, email {mail} from the email address on your account. Most things, like your name, email
        settings and WhatsApp updates, you can also change yourself in the app. We reply within 30 days. To delete
        your whole account, email us with the subject &ldquo;Delete my account&rdquo;; we confirm it is you, then
        delete it.
      </p>
      <p>
        If you are not happy with our reply, you can contact our Grievance Officer (below) and, after that, complain
        to the Data Protection Board of India.
      </p>

      <h2>8. Children</h2>
      <p>
        {BRAND.name} is for businesses. It is not meant for anyone under 18, and we do not knowingly collect
        information about children.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date at the top. If the change is important, we will email
        account owners before it starts.
      </p>

      <h2>10. Contact us</h2>
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
      <p>
        Grievance Officer: {GRIEVANCE_OFFICER}, reachable at {mail}. We acknowledge complaints within 24 hours and
        aim to resolve them within 15 days.
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
