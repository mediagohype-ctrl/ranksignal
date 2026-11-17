import type { Metadata } from "next";
import { Building2, LifeBuoy, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui";
import { BRAND, hasBookingCalendar } from "@/lib/brand";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ContactForm } from "@/components/marketing/contact-form";
import { BookCallButton, ContactCard, contactWhatsappHref } from "@/components/marketing/contact-card";
import { REPLY_TIME } from "@/components/marketing/contact-copy";
import { CUSTOM_PLAN, DFY_PLAN, type ServiceTierId } from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { siteUrl, webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/contact");

const REASONS = [
  { icon: <MessageSquare />, title: "Questions before you start", body: "Not sure what the report covers or which plan fits? Ask away." },
  { icon: <Building2 />, title: `${CUSTOM_PLAN.name} plans`, body: "Many websites, brands or cities, or reports with your logo? Tell us roughly how many." },
  { icon: <LifeBuoy />, title: "Help with your account", body: "Already a customer? Add your business name so we can help faster." },
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
  // "Book a free call": a real calendar opens in a new tab once BRAND_BOOKING_URL is set; until then the form is
  // the way to ask for a call, and it says so.
  const calendar = hasBookingCalendar();
  // The full Organization (email, address, contactPoint) is in the layout's graph; point at it by @id.
  const jsonLd = webPageLd("/contact", {
    type: "ContactPage",
    name: `Contact ${BRAND.name}`,
    extra: { mainEntity: { "@id": `${siteUrl()}/#organization` } },
  });
  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow={isServices ? DFY_PLAN.name : isCustom ? `${CUSTOM_PLAN.name} plan` : "Contact"}
        title={isServices ? "Book a free 30-minute call" : isCustom ? "Let's talk about a Custom plan" : "Talk to a real person."}
        intro={
          isServices ? (
            <p>
              {calendar
                ? "Pick a time, or send us a message below. We look at your website and AI answers together."
                : "Tell us about your business below and we'll fix a time. We look at your website and AI answers together."}{" "}
              {REPLY_TIME.en}
            </p>
          ) : isCustom ? (
            <p>For many websites, brands or cities, a dedicated team, or reports with your logo. {REPLY_TIME.en}</p>
          ) : (
            <p>Questions about plans, getting started or your report? {REPLY_TIME.en}</p>
          )
        }
      >
        {calendar && <BookCallButton onDark />}
      </PageHero>
      <section aria-label="Contact form" className="bg-bg py-14 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <Card variant="elevated" padding="lg" className="relative">
            <ContactForm
              supportEmail={BRAND.supportEmail}
              topic={isServices ? "services" : isCustom ? "custom" : undefined}
              tierName={tierName}
              whatsappHref={contactWhatsappHref("en")}
              callViaForm={!calendar}
            />
          </Card>
          <aside aria-label="Other ways to reach us" className="space-y-8">
            <ContactCard />
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
          </aside>
        </div>
      </section>
    </>
  );
}
