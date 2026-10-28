import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LegalPage } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of service (draft)",
  description: `Draft terms of service for ${BRAND.name}, pending legal review.`,
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Draft">
      <h2>The service</h2>
      <p>
        {BRAND.name} provides tools to audit websites, measure brand visibility in AI-generated answers, recommend
        improvements and, where you authorise it, publish approved changes through connected systems.
      </p>
      <h2>No guaranteed outcomes</h2>
      <p>
        AI answer engines and search engines are operated by third parties. {BRAND.name} does not guarantee any ranking,
        mention, citation, traffic or revenue outcome. Metrics are estimates derived from samples.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>You must own or be authorised to manage every site and integration you connect.</li>
        <li>You are responsible for reviewing and approving changes before they are published.</li>
        <li>You must not use the service to crawl sites you are not permitted to, or for unlawful purposes.</li>
      </ul>
      <h2>Subscriptions and trials</h2>
      <p>
        Paid plans are billed monthly in advance. Prices exclude GST, which is charged at the applicable rate. Free
        trials convert to a paid plan only if you choose a plan and provide payment details.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent permitted by law, our liability is limited to the fees you paid in the three months before the
        claim. Full terms, including governing law and dispute resolution, will be added after legal review.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
