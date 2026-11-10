import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/marketing/ui";
import { SampleResult } from "@/components/marketing/home-sample";
import { TRIAL_DAYS } from "@/components/marketing/plans";
import { HOME_FAQ, HI_PLANS } from "@/components/marketing/hi/content";
import { HiCheckLauncher, HiFaqSection, HiPlanCards } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { faqLd, siteUrl } from "@/lib/seo/schema";

// Hindi home page (/hi). Title and description live in src/lib/seo/pages.ts; hreflang comes from hi/pairs.ts.
export const metadata: Metadata = staticPageMetadata("/hi", {
  keywords: ["SEO चेकर", "वेबसाइट SEO रिपोर्ट", "AEO", "GEO", "ChatGPT SEO", "भारत में SEO कंपनी"],
});

const TERMS = [
  { term: "SEO", name: "सर्च इंजन", line: "क्या Google और Bing आपके पेज ढूँढ, पढ़ और उन पर भरोसा कर पाते हैं?" },
  { term: "AEO", name: "आंसर इंजन", line: "क्या आपके पेज सवालों के छोटे, सीधे जवाब देते हैं, जिन्हें कोट किया जा सके?" },
  { term: "GEO", name: "जनरेटिव AI", line: "क्या ChatGPT, Gemini जैसे AI आपका नाम लेते हैं और आपकी साइट का लिंक देते हैं?" },
];

const STEPS = [
  { title: "चेक करें", body: "अपनी वेबसाइट का पता डालें। हम उसे पढ़ते हैं और ChatGPT, Gemini जैसे AI से वही सवाल पूछते हैं जो आपके ग्राहक पूछते हैं।" },
  { title: "सुधारें", body: "आपको काम की एक छोटी लिस्ट मिलती है, सबसे ज़रूरी काम सबसे ऊपर। हर सुधार आसान शब्दों में बताता है कि क्या बदलना है।" },
  { title: "आगे बढ़ें", body: "जो सुधार चाहिए उन्हें मंज़ूरी दें। हम हर महीने फिर से चेक करते हैं, ताकि आप देख सकें कि क्या बदला।" },
];

export default function HindiHomePage() {
  return (
    <>
      <JsonLd data={[hiWebPageLd("/hi", { base: siteUrl() }), faqLd(HOME_FAQ)]} />

      {/* Hero */}
      <section aria-labelledby="hi-hero-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 id="hi-hero-title" className="mk-label mk-rise text-primary">
              फ्री SEO, AEO और GEO वेबसाइट चेकर
            </h1>
            <p className="mk-hero mk-rise mt-5 text-fg">
              चेक करें। सुधारें। <span className="text-primary">आगे बढ़ें।</span>
            </p>
            <p className="mk-lead mk-rise mk-delay-1 mx-auto mt-8 max-w-[36rem] text-fg-soft">
              देखिए कि Google और ChatGPT जैसे AI असिस्टेंट आपके बिज़नेस को कैसे देखते हैं। सबसे ज़रूरी सुधार आसान भाषा में पाइए,
              ताकि ग्राहक आपको आसानी से ढूँढ सकें।
            </p>
            <HiCheckLauncher id="hi-hero-url" className="mk-rise mk-delay-2 mx-auto mt-9 max-w-[36rem] text-left" />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section id="sample" aria-labelledby="hi-sample-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="mk-reveal lg:col-span-5">
            <p className="mk-label">आपको क्या मिलता है</p>
            <h2 id="hi-sample-title" className="mk-title mt-4 max-w-[16ch] text-fg">
              एक स्कोर। सबसे ज़रूरी सुधार।
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              करीब 30 सेकंड में आपको 100 में से एक स्कोर और वे तीन सुधार दिखते हैं जो सबसे ज़्यादा मदद करेंगे — हर सुधार के साथ यह भी कि
              उससे कितने पॉइंट बढ़ सकते हैं।
            </p>
            <dl className="mt-8 space-y-4">
              {TERMS.map((t) => (
                <div key={t.term} className="flex gap-4">
                  <dt className="w-14 shrink-0 font-semibold text-primary">{t.term}</dt>
                  <dd className="text-fg-soft">
                    <span className="font-medium text-fg">{t.name}।</span> {t.line}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mk-body mt-6 max-w-md text-small text-muted">
              SEO, AEO और GEO एक ही मकसद के तीन नाम हैं: जब कोई आपकी चीज़ या सेवा ढूँढे, तो उसे आप मिलें। नीचे का नमूना अंग्रेज़ी में है।
            </p>
          </div>
          <div lang="en" className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
            <SampleResult />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="how-it-works" aria-labelledby="hi-how-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="hi-how-title" className="mk-title max-w-[18ch] text-fg">
              तीन कदम। शुरू करने में करीब एक मिनट।
            </h2>
            <Link
              href="/hi/services"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              काम हमारी टीम से करवाएँ
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16">
            {STEPS.map((s, i) => (
              <li key={s.title} className="mk-reveal border-t border-fg pt-6">
                <span aria-hidden className="text-small font-medium tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[1.5rem] font-semibold text-fg">
                  <span className="sr-only">कदम {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Plans */}
      <section id="pricing" aria-labelledby="hi-pricing-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <div className="mk-reveal max-w-2xl">
            <h2 id="hi-pricing-title" className="mk-title text-fg">
              आसान प्लान। {TRIAL_DAYS} दिन फ्री।
            </h2>
            <p className="mk-body mt-4 text-fg-soft">कीमतें भारतीय रुपये में, GST अलग। जब चाहें बंद करें।</p>
          </div>
          <div className="mt-12">
            <HiPlanCards plans={HI_PLANS} limit={4} />
          </div>
          <p className="mt-8 text-center text-small text-muted">
            <Link href="/hi/pricing" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              सभी प्लान की पूरी तुलना देखें
            </Link>
          </p>
        </div>
      </section>

      <HiFaqSection id="faq" title="सवाल, सीधे जवाब।" items={HOME_FAQ} />
    </>
  );
}
