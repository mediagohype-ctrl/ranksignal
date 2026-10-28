import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LegalPage } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: `Privacy Policy (draft) — ${BRAND.name}`,
  description: `Draft privacy policy for ${BRAND.name}, pending legal review.`,
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Draft">
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email address, organisation name and billing details.</li>
        <li>Project data: domains, brand names, competitors, tracked prompts and settings you provide.</li>
        <li>Public data we gather for you: crawled public pages and answers returned by AI answer engines.</li>
        <li>Integration credentials (e.g. WordPress application passwords), stored encrypted at rest.</li>
        <li>Usage and security logs, including an audit log of approvals and published changes.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To provide the service, secure accounts, bill subscriptions, and improve {BRAND.name}. We do not sell personal
        data. We use your integration credentials only to perform actions permitted by your approval policy.
      </p>
      <h2>Sub-processors</h2>
      <p>
        We use third-party providers for hosting, payments and AI model access. Prompts you track may be sent to those
        AI providers to generate answers. A list of sub-processors will be published here.
      </p>
      <h2>Retention and your rights</h2>
      <p>
        We retain data for as long as your account is active and for a limited period afterwards, unless law requires
        otherwise. You may request access, correction or deletion of your personal data, including under India&apos;s
        Digital Personal Data Protection Act, 2023, where applicable.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
