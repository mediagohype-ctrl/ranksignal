import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { DFY_PLAN, TRIAL_DAYS, gstOn, inr, inrGst, priceNote, newTabProps } from "@/components/marketing/plans";
import { HI_DFY, HI_OFFER, HI_SELF, HI_TRIAL_AI, PRICING_FAQ, SOFTWARE_FROM, type HindiOfferCard } from "@/components/marketing/hi/content";
import { HiFaqSection, HiFinalCta } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { faqLd, siteUrl } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/pricing");

const COMPARE = [
  { label: "काम कौन करता है", diy: "आप या आपकी टीम, हमारे बताए सुधारों के साथ।", dfy: "हमारी टीम, आपकी मंज़ूरी के साथ।" },
  { label: "आपका समय", diy: "हर हफ़्ते थोड़ा समय सुधारों के लिए।", dfy: "शुरू में करीब एक घंटा, फिर सिर्फ़ मंज़ूरियाँ।" },
  { label: "कीमत", diy: `${inrGst(SOFTWARE_FROM)} महीना, पहले ${TRIAL_DAYS} दिन फ्री`, dfy: `${inrGst(DFY_PLAN.price)} महीना, कोई सेटअप फ़ीस नहीं` },
  { label: "अवधि", diy: "कभी भी बंद करें।", dfy: `${DFY_PLAN.minimumMonths} महीने, फिर महीने-दर-महीने।` },
  { label: "किसके लिए सही", diy: "मालिक और मार्केटर, जो खुद काम करना पसंद करते हैं।", dfy: "व्यस्त मालिक, जो चाहते हैं कि काम हो जाए और हर महीने सबूत मिले।" },
];

const per = () => (gstOn() ? "+ GST / महीना" : "/ महीना");

function OfferCard({ c }: { c: HindiOfferCard }) {
  const ink = !!c.featured;
  return (
    <li className={clsx("mk-reveal flex flex-col rounded-[28px] p-7 sm:p-9", ink ? "bg-fg text-bg" : "border border-border bg-surface")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={clsx("text-[1.5rem] font-semibold leading-tight", ink ? "text-bg" : "text-fg")}>
          {c.name}
          <span className={clsx("ml-2 text-small font-normal", ink ? "text-bg/70" : "text-muted")} lang="en">
            ({c.en})
          </span>
        </h3>
        {c.tag && <span className="inline-flex h-7 items-center rounded-full bg-bg px-3 text-xs font-semibold text-fg">{c.tag}</span>}
      </div>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className={clsx("text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums", ink ? "text-bg" : "text-fg")}>
          {c.price === null ? c.priceLabel : inr(c.price)}
        </span>
        {c.price !== null && <span className={clsx("text-small", ink ? "text-bg/75" : "text-muted")}>{per()}</span>}
      </p>
      <p className={clsx("mt-3 text-small", ink ? "text-bg/75" : "text-muted")}>{c.terms}</p>
      <p className={clsx("mt-5 text-[1rem] font-medium", ink ? "text-bg" : "text-fg")}>{c.line1}</p>
      <p className={clsx("mt-1 text-small", ink ? "text-bg/80" : "text-fg-soft")}>{c.line2}</p>
      <Link href={c.href} {...newTabProps(c.href)} className={inkPill("lg", ink, "mt-8 w-full")}>
        {c.cta}
        <ArrowRight aria-hidden />
      </Link>
      <div className={clsx("mt-8 flex-1 border-t pt-6", ink ? "border-bg/20" : "border-border")}>
        {c.inherits && <p className={clsx("mb-4 text-small font-semibold", ink ? "text-bg" : "text-fg")}>{c.inherits}</p>}
        <ul className="space-y-3">
          {c.includes.map((i) => (
            <li key={i} className={clsx("flex gap-3 text-small", ink ? "text-bg/85" : "text-fg-soft")}>
              <Check aria-hidden size={16} className={clsx("mt-0.5 shrink-0", ink ? "text-bg" : "text-primary")} />
              {i}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function HindiPricingPage() {
  const base = siteUrl();
  // Only the two priced plans are offers; Custom has no public price.
  const offersLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "MyWebRank प्लान",
    url: `${base}/hi/pricing`,
    itemListElement: [HI_SELF, HI_DFY].map((c) => ({
      "@type": "Offer",
      name: `${c.name} (${c.en})`,
      url: `${base}/hi/pricing#plans`,
      price: String(c.price),
      priceCurrency: "INR",
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(c.price), priceCurrency: "INR", unitCode: "MON", valueAddedTaxIncluded: false },
    })),
  };

  return (
    <>
      <JsonLd data={[hiWebPageLd("/hi/pricing", { base }), offersLd, faqLd(PRICING_FAQ)]} />

      <section aria-labelledby="hi-pricing-title" className="border-b border-border">
        <div className="container-marketing pb-14 pt-14 sm:pb-16 sm:pt-20">
          <h1 id="hi-pricing-title" className="mk-label mk-rise">
            कीमतें: SEO सॉफ़्टवेयर और हमारी SEO सेवा
          </h1>
          <p className="mk-hero mk-rise mt-5 max-w-[16ch] text-fg">खुद करें, या हमसे करवाएँ।</p>
          <p className="mk-lead mk-rise mk-delay-1 mt-8 max-w-[40rem] text-fg-soft">
            “{HI_SELF.name}” {inrGst(SOFTWARE_FROM)} महीना, पहले {TRIAL_DAYS} दिन फ्री। या “{HI_DFY.name}” — हमारी टीम सारा काम करती है,{" "}
            {inrGst(DFY_PLAN.price)} महीना, कोई सेटअप फ़ीस नहीं। {priceNote(true)}
          </p>
        </div>
      </section>

      {/* Plans: Do it myself · Do it for me (dark, featured) · Custom */}
      <section id="plans" aria-labelledby="hi-plans-title" className="scroll-mt-20 bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <span id="software" className="block scroll-mt-20" aria-hidden />
          <span id="services" className="block scroll-mt-20" aria-hidden />
          <p className="mk-label">प्लान</p>
          <h2 id="hi-plans-title" className="mk-title mt-4 max-w-[20ch] text-fg">
            दो आसान प्लान। बड़ी ज़रूरत हो तो कस्टम।
          </h2>
          <p className="mk-body mt-4 max-w-2xl text-fg-soft">
            फ्री ट्रायल में पूरी वेबसाइट रिपोर्ट और {HI_TRIAL_AI} मिलते हैं। कार्ड की ज़रूरत नहीं, और आप खुद प्लान न चुनें, तब तक कोई पैसा नहीं कटता।
          </p>
          <ul className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {HI_OFFER.map((c) => (
              <OfferCard key={c.key} c={c} />
            ))}
          </ul>
          <p className="mt-8">
            <Link
              href="/hi/services"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              “{HI_DFY.name}” में क्या-क्या मिलता है, पूरा देखें
              <ArrowRight aria-hidden size={17} />
            </Link>
          </p>
        </div>
      </section>

      {/* Which one */}
      <section aria-labelledby="hi-which-title" className="py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="hi-which-title" className="mk-title max-w-[18ch] text-fg">
            आपके लिए कौन-सा सही है?
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[36rem] text-left text-small">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-4 font-medium text-muted">
                    <span className="sr-only">तुलना</span>
                  </th>
                  <th scope="col" className="p-4 font-semibold text-fg">{HI_SELF.name} ({HI_SELF.en})</th>
                  <th scope="col" className="p-4 font-semibold text-fg">{HI_DFY.name} ({HI_DFY.en})</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.label} className="border-b border-border last:border-0">
                    <th scope="row" className="p-4 font-medium text-fg">{r.label}</th>
                    <td className="p-4 text-fg-soft">{r.diy}</td>
                    <td className="p-4 text-fg-soft">{r.dfy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <HiFaqSection id="faq" title="कीमतों से जुड़े सवाल" items={PRICING_FAQ} />

      <HiFinalCta
        title="पक्का नहीं? पहले फ्री चेक चलाइए।"
        body={
          <p>
            30 सेकंड में देखिए कि Google और AI आपकी वेबसाइट को कैसे देखते हैं —{" "}
            <Link href="/hi/free-check" className="underline underline-offset-4">
              फ्री वेबसाइट चेक
            </Link>
            , कोई साइन-अप नहीं।
          </p>
        }
      />
    </>
  );
}
