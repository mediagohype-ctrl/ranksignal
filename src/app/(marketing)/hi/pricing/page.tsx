import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/marketing/ui";
import { SERVICE_FROM_PRICE, TRIAL_DAYS, inr, inrGst, priceNote } from "@/components/marketing/plans";
import { HI_PLANS, HI_SERVICE_TIERS, HI_TRIAL_AI, PRICING_FAQ, SOFTWARE_FROM } from "@/components/marketing/hi/content";
import { HiFaqSection, HiFinalCta, HiPlanCards } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { faqLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/pricing");

const COMPARE = [
  { label: "काम कौन करता है", diy: "आप या आपकी टीम, हमारे बताए सुधारों के साथ।", dfy: "हमारी टीम, आपकी मंज़ूरी के साथ।" },
  { label: "आपका समय", diy: "हर हफ़्ते थोड़ा समय सुधारों के लिए।", dfy: "शुरू में करीब एक घंटा, फिर सिर्फ़ मंज़ूरियाँ।" },
  { label: "कीमत", diy: `${inrGst(SOFTWARE_FROM)} महीने से`, dfy: `${inrGst(SERVICE_FROM_PRICE)} महीने से` },
  { label: "किसके लिए सही", diy: "मालिक, मार्केटर और एजेंसियाँ, जो खुद काम करना पसंद करते हैं।", dfy: "व्यस्त मालिक, जो चाहते हैं कि काम हो जाए और हर महीने सबूत मिले।" },
];

export default function HindiPricingPage() {
  return (
    <>
      <JsonLd data={[hiWebPageLd("/hi/pricing"), faqLd(PRICING_FAQ)]} />

      <section aria-labelledby="hi-pricing-title" className="border-b border-border">
        <div className="container-marketing pb-14 pt-14 sm:pb-16 sm:pt-20">
          <h1 id="hi-pricing-title" className="mk-label mk-rise">
            कीमतें: SEO सॉफ़्टवेयर और हमारी SEO सेवा
          </h1>
          <p className="mk-hero mk-rise mt-5 max-w-[16ch] text-fg">खुद करें, या हमसे करवाएँ।</p>
          <p className="mk-lead mk-rise mk-delay-1 mt-8 max-w-[40rem] text-fg-soft">
            सॉफ़्टवेयर {inrGst(SOFTWARE_FROM)} महीने से, पहले {TRIAL_DAYS} दिन फ्री। या हमारी टीम हर महीने आपकी वेबसाइट सुधारे —{" "}
            {inr(SERVICE_FROM_PRICE)} महीने से। {priceNote(true)}
          </p>
        </div>
      </section>

      {/* Software plans */}
      <section id="software" aria-labelledby="hi-software-title" className="scroll-mt-20 bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <p className="mk-label">सॉफ़्टवेयर — खुद करें</p>
          <h2 id="hi-software-title" className="mk-title mt-4 max-w-[20ch] text-fg">
            {TRIAL_DAYS} दिन फ्री आज़माएँ, फिर प्लान चुनें।
          </h2>
          <p className="mk-body mt-4 max-w-2xl text-fg-soft">
            फ्री ट्रायल में पूरी वेबसाइट रिपोर्ट और {HI_TRIAL_AI} मिलते हैं। आप खुद प्लान न चुनें, तब तक कोई पैसा नहीं कटता।
          </p>
          <div className="mt-12">
            <HiPlanCards plans={HI_PLANS} />
          </div>
        </div>
      </section>

      {/* Done-for-you */}
      <section id="services" aria-labelledby="hi-dfy-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-marketing">
          <p className="mk-label">सेवा — हमसे करवाएँ</p>
          <h2 id="hi-dfy-title" className="mk-title mt-4 max-w-[20ch] text-fg">
            हमारी टीम हर महीने सुधार करती है।
          </h2>
          <p className="mk-body mt-4 max-w-2xl text-fg-soft">
            हम आपके साथ प्लान तय करते हैं, आपकी मंज़ूरी से सुधार करते हैं और हर महीने बताते हैं कि क्या बदला। कीमत में एक बार की सेटअप फ़ीस
            अलग से लगती है।
          </p>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {HI_SERVICE_TIERS.map((t) => (
              <li key={t.id} className={"rounded-2xl border bg-surface p-6 sm:p-8 " + (t.featured ? "border-primary ring-1 ring-primary" : "border-border")}>
                <h3 className="text-h4 text-fg">{t.name}</h3>
                <p className="mt-4 text-[2rem] font-semibold leading-none tabular-nums text-fg">
                  {inr(t.price)}
                  <span className="ml-1 text-small font-normal text-muted">/ महीना</span>
                </p>
                <p className="mt-3 text-small text-muted">
                  + {inr(t.setup)} सेटअप · कम से कम {t.minimumMonths} महीने
                </p>
                <p className="mt-4 text-small text-fg-soft">{t.blurb}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link
              href="/hi/services"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              सेवा में क्या-क्या मिलता है, पूरा देखें
              <ArrowRight aria-hidden size={17} />
            </Link>
          </p>
        </div>
      </section>

      {/* Which one */}
      <section aria-labelledby="hi-which-title" className="border-t border-border bg-surface-2/50 py-20 sm:py-28">
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
                  <th scope="col" className="p-4 font-semibold text-fg">सॉफ़्टवेयर (खुद करें)</th>
                  <th scope="col" className="p-4 font-semibold text-fg">सेवा (हमसे करवाएँ)</th>
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
