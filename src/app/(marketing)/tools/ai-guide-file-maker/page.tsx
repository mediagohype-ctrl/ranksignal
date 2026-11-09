import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SectionHeading } from "@/components/ui";
import { GuideMaker } from "../_components/guide-maker";
import { LeadBox } from "../_components/lead-box";

const PATH = "/tools/ai-guide-file-maker";
const TITLE = "Free llms.txt Generator: make your AI guide file";
const DESCRIPTION =
  "Make an AI guide file (llms.txt) for your website in two minutes: tell ChatGPT and other AI tools who you are and which pages matter. Free, no sign-up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: PATH, siteName: BRAND.name, type: "website" },
};

const HOW = [
  { q: "What is an AI guide file?", a: "A short text file on your website (yoursite.com/llms.txt) that tells AI tools what your business does and which pages to read first. Experts call it llms.txt." },
  { q: "Where do I put it?", a: "Upload it to the main folder of your website, next to your home page. Your web person or hosting file manager can do it in a minute." },
  { q: "Will AI tools use it?", a: "Some AI tools read it today and more are starting to. It's free, takes two minutes and does no harm." },
];

export default function AiGuideFileMakerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AI guide file maker",
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
        title="Free llms.txt generator: make an AI guide file for your website"
        intro={<p>Tell ChatGPT and other AI tools who you are and which pages matter. Fill in the boxes, then download your file.</p>}
      />
      <section aria-label="Make your AI guide file" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <GuideMaker />
          <LeadBox tool="ai-guide-file-maker" />
        </div>
      </section>
      <Section labelledBy="guide-how" tone="surface">
        <SectionHeading id="guide-how" size="lg" align="center" eyebrow="Questions" title="How it works" />
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
