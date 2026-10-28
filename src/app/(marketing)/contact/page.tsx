import type { Metadata } from "next";
import { Building2, Mail, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ContactForm } from "@/components/marketing/contact-form";

const DESCRIPTION = `Contact the ${BRAND.name} team about agency plans, many client sites, onboarding help or anything else. We usually reply within one business day.`;

export const metadata: Metadata = {
  title: "Contact us",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: `Contact ${BRAND.name}`, description: DESCRIPTION, url: "/contact", siteName: BRAND.name, type: "website" },
};

const REASONS = [
  { icon: <Building2 />, title: "Agency plans", body: "Managing many client sites? Tell us roughly how many and we'll suggest limits that fit." },
  { icon: <MessageSquare />, title: "Questions before you start", body: "Not sure what the report covers or how approvals work? Ask away." },
  { icon: <Mail />, title: "Support", body: "Already a customer? Include your workspace name so we can help faster." },
];

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${BRAND.name}`,
    url: `${BRAND.appUrl.replace(/\/$/, "")}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: BRAND.name,
      url: BRAND.appUrl,
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BRAND.supportEmail, availableLanguage: ["English"] },
    },
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        intro={<p>Questions about agency plans, onboarding or your report? Send us a message and a real person will reply.</p>}
      />
      <section aria-label="Contact form" className="bg-bg py-14 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <Card variant="elevated" padding="lg" className="relative">
            <ContactForm supportEmail={BRAND.supportEmail} />
          </Card>
          <aside aria-label="Ways we can help" className="space-y-6">
            <ul className="space-y-6">
              {REASONS.map((r) => (
                <li key={r.title} className="flex gap-4">
                  <IconTile className="size-10">{r.icon}</IconTile>
                  <div>
                    <h2 className="text-body font-semibold text-fg">{r.title}</h2>
                    <p className="mt-1 text-small leading-relaxed text-muted">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-small text-fg-soft">
              Prefer email? Write to{" "}
              <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {BRAND.supportEmail}
              </a>
              .
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
