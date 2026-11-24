// Free AI visibility checker (SEO fix brief P1): does ChatGPT, Gemini or Perplexity name the business? Replaces the old
// /tools/ai-mention-checker (308 redirect in src/lib/seo/redirects.ts). The tool runs without login; the result
// shows before any email or sign-up.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero } from "@/components/marketing/ui";
import { QaSection, SourcesList } from "@/components/marketing/answers";
import { AiVisibilityChecker } from "../_components/ai-visibility-checker";
import { AI_VISIBILITY_FAQ, AiVisibilityCheckerContent } from "@/components/marketing/ai-visibility-checker-content";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/ai-visibility-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

export default function AiVisibilityCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AI visibility checker",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            provider: { "@id": `${base}/#organization` },
          },
          faqLdFromQa(AI_VISIBILITY_FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "AI visibility checker", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free AI tool"
        title="Free AI visibility checker: does ChatGPT mention your business?"
        intro={
          <p>
            Type your business name and what you do. We ask ChatGPT, Gemini and Perplexity the question your customers ask, and
            show whether each one names you, where you appear in the list, and who they name instead. Free, no sign-up.
          </p>
        }
      />
      <section aria-label="Check your AI visibility" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing">
          <AiVisibilityChecker />
        </div>
      </section>
      <AiVisibilityCheckerContent />
      <QaSection id="avc-faq" tone="surface" title="AI visibility checker: common questions" items={AI_VISIBILITY_FAQ}>
        <p className="text-body leading-relaxed text-fg-soft">
          Want to know why AI picks someone else?{" "}
          <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">
            Run the free website check
          </Link>{" "}
          for your SEO, AEO and GEO scores, or read{" "}
          <Link href="/learn/how-to-get-mentioned-by-chatgpt" className="font-medium text-primary underline-offset-4 hover:underline">
            how to get your business on ChatGPT
          </Link>
          .
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://platform.openai.com/docs/bots", label: "OpenAI: overview of OpenAI crawlers" },
            { href: "https://arxiv.org/abs/2311.09735", label: "Aggarwal et al. (2023): GEO: Generative Engine Optimization (arXiv)" },
          ]}
        />
      </QaSection>
    </>
  );
}
