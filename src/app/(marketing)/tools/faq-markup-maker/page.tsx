import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SectionHeading } from "@/components/ui";
import { FaqMaker } from "../_components/faq-maker";
import { LeadBox } from "../_components/lead-box";

const PATH = "/tools/faq-markup-maker";
const TITLE = "Free FAQ code maker: info for Google and AI";
const DESCRIPTION =
  "Type your customers' questions and your answers. Get ready-to-paste code (FAQ schema) that helps Google and AI tools like ChatGPT understand and quote your answers. Free, no sign-up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: PATH, siteName: BRAND.name, type: "website" },
};

const HOW = [
  { q: "What is this code?", a: "It's a small hidden note on your page that lists your questions and answers in a format Google and AI tools read easily. Visitors don't see it." },
  { q: "Where do I paste it?", a: "On the same page that shows these questions and answers. In WordPress, add a \"Custom HTML\" block and paste it there." },
  { q: "Does it cost anything?", a: "No. The tool is free and runs in your browser. We don't save what you type." },
];

export default function FaqMarkupMakerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "FAQ code maker",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOW.map((h) => ({ "@type": "Question", name: h.q, acceptedAnswer: { "@type": "Answer", text: h.a } })),
          },
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Info for Google and AI: FAQ code maker"
        intro={<p>Type the questions customers ask and your answers. Copy the code onto your page so Google and AI tools can quote you.</p>}
      />
      <section aria-label="Make your FAQ code" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <FaqMaker />
          <LeadBox tool="faq-markup-maker" />
        </div>
      </section>
      <Section labelledBy="faq-how" tone="surface">
        <SectionHeading id="faq-how" size="lg" align="center" eyebrow="Questions" title="How it works" />
        <dl className="mx-auto max-w-3xl space-y-6">
          {HOW.map((h) => (
            <div key={h.q}>
              <dt className="text-h4 text-fg">{h.q}</dt>
              <dd className="mt-1 text-small leading-relaxed text-muted">{h.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
