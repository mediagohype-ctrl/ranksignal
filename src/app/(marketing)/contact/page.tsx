import type { Metadata } from "next";
import { Building2, Mail, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ContactForm } from "@/components/marketing/contact-form";
import { CUSTOM_PLAN, DFY_PLAN, type ServiceTierId } from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { siteUrl, webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/contact");

const REASONS = [
  { icon: <Building2 />, title: "Custom plans", body: "Many websites, brands or cities, or reports with your logo for clients? Tell us roughly how many and we'll suggest a plan that fits." },
  { icon: <MessageSquare />, title: "Questions before you start", body: "Not sure what the report covers or how approvals work? Ask away." },
  { icon: <Mail />, title: "Support", body: "Already a customer? Include your workspace name so we can help faster." },
];

const SERVICE_TIER_NAMES: Record<ServiceTierId, string> = { fix: DFY_PLAN.name };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const topicParam = one(sp.topic);
  const isServices = topicParam === "services";
  const isCustom = topicParam === "custom";
  const tierParam = one(sp.tier);
  const tierName = isServices && tierParam && tierParam in SERVICE_TIER_NAMES ? SERVICE_TIER_NAMES[tierParam as ServiceTierId] : undefined;
  // The full Organization (email, phone, address, contactPoint) is in the layout's graph; point at it by @id.
  const jsonLd = webPageLd("/contact", {
    type: "ContactPage",
    name: `Contact ${BRAND.name}`,
    extra: { mainEntity: { "@id": `${siteUrl()}/#organization` } },
  });
  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow={isServices ? "Done-for-you services" : isCustom ? `${CUSTOM_PLAN.name} plan` : "Contact"}
        title={isServices ? "Book a free call" : isCustom ? "Let's talk about a Custom plan" : "Talk to us"}
        intro={
          isServices ? (
            <p>Tell us about your business and we&apos;ll set up a free 30-minute call to look at your site and AI answers together.</p>
          ) : isCustom ? (
            <p>
              For many websites, brands or cities, a dedicated team, reports with your logo, or API and dashboard access. Tell us
              what you need and a real person will reply.
            </p>
          ) : (
            <p>Questions about plans, onboarding or your report? Send us a message and a real person will reply.</p>
          )
        }
      />
      <section aria-label="Contact form" className="bg-bg py-14 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <Card variant="elevated" padding="lg" className="relative">
            <ContactForm supportEmail={BRAND.supportEmail} topic={isServices ? "services" : isCustom ? "custom" : undefined} tierName={tierName} />
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
