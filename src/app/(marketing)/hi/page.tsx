import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { SAMPLE_FIXES, SAMPLE_SCORE } from "@/components/marketing/home-sample";
import { SampleScoreCard } from "@/components/marketing/showcase/sample-score";
import { TRIAL_DAYS, gstOn, inr, newTabProps } from "@/components/marketing/plans";
import { HOME_FAQ, HI_OFFER } from "@/components/marketing/hi/content";
import { HiCheckLauncher, HiFaqSection } from "@/components/marketing/hi/hi-ui";
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

// Sample result (same business, score and points as the English sample in home-sample.tsx), in Hindi.
// Area scores are consistent with the overall score under the report weights (SEO .35, AEO .20, GEO .30, Brand .15).
const SAMPLE_PILLARS = [
  { label: "SEO", score: 62 },
  { label: "AEO", score: 48 },
  { label: "GEO", score: 38 },
  { label: "Brand", score: 56 },
];
const SAMPLE_FIX_TEXT = [
  { title: "होमपेज पर साफ़ लिखें कि आप क्या बेचते हैं और कहाँ", why: "Google और ChatGPT समझ नहीं पाते कि आप इंदिरानगर में डिलीवरी करते हैं।" },
  { title: "6 पेज पर Google समरी जोड़ें", why: "Google अंदाज़ा लगा रहा है कि आपके नाम के नीचे क्या दिखाए।" },
  { title: "“क्या आप डिलीवरी करते हैं?” का जवाब एक साफ़ लाइन में दें", why: "AI असिस्टेंट ऐसा छोटा जवाब ढूँढते हैं जिसे वे कोट कर सकें।" },
];
const SAMPLE_FIXES_HI = SAMPLE_FIX_TEXT.map((f, i) => ({ ...f, points: `+${SAMPLE_FIXES[i].points} पॉइंट` }));
const SAMPLE_GAIN = SAMPLE_FIXES.reduce((a, f) => a + f.points, 0);

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
              SEO, AEO और GEO एक ही मकसद के तीन नाम हैं: जब कोई आपकी चीज़ या सेवा ढूँढे, तो उसे आप मिलें।
            </p>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
            <SampleScoreCard
              site="greenleaf-bakery.example"
              tag="नमूना"
              score={SAMPLE_SCORE}
              ringLabel={`नमूना स्कोर: 100 में से ${SAMPLE_SCORE}, सुधार चाहिए`}
              bandLabel="सुधार चाहिए"
              headline={`${SAMPLE_SCORE} / 100 · सुधार चाहिए`}
              sub={`3 सुधार से स्कोर ${SAMPLE_GAIN} पॉइंट तक बढ़ सकता है।`}
              pillarsTitle="चार हिस्सों के स्कोर (100 में से)"
              pillars={SAMPLE_PILLARS}
              fixes={SAMPLE_FIXES_HI}
              caption="नमूना नतीजा: एक काल्पनिक बेकरी की वेबसाइट का फ्री चेक। आपके असली नतीजे चेक चलाने पर दिखेंगे।"
            />
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
              खुद करें, या हमसे करवाएँ।
            </h2>
            <p className="mk-body mt-4 text-fg-soft">
              कीमतें भारतीय रुपये में{gstOn() ? ", GST अलग" : ""}। “मैं ख़ुद करूँगा” पहले {TRIAL_DAYS} दिन फ्री।
            </p>
          </div>
          <ul className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {HI_OFFER.map((c) => {
              const ink = !!c.featured;
              return (
                <li key={c.key} className={clsx("mk-reveal flex flex-col rounded-[28px] p-7 sm:p-8", ink ? "bg-fg text-bg" : "border border-border bg-surface")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className={clsx("text-[1.375rem] font-semibold leading-tight", ink ? "text-bg" : "text-fg")}>
                      {c.name}
                      <span className={clsx("ml-2 text-small font-normal", ink ? "text-bg/70" : "text-muted")} lang="en">
                        ({c.en})
                      </span>
                    </h3>
                    {c.tag && <span className="inline-flex h-7 items-center rounded-full bg-bg px-3 text-xs font-semibold text-fg">{c.tag}</span>}
                  </div>
                  <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
                    <span className={clsx("text-[2.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums", ink ? "text-bg" : "text-fg")}>
                      {c.price === null ? c.priceLabel : inr(c.price)}
                    </span>
                    {c.price !== null && (
                      <span className={clsx("text-small", ink ? "text-bg/75" : "text-muted")}>{gstOn() ? "+ GST / महीना" : "/ महीना"}</span>
                    )}
                  </p>
                  <p className={clsx("mt-5 flex-1 text-[1rem]", ink ? "text-bg" : "text-fg")}>
                    {c.line1}
                    <span className={clsx("mt-1 block text-small", ink ? "text-bg/80" : "text-fg-soft")}>{c.line2}</span>
                  </p>
                  <Link href={c.href} {...newTabProps(c.href)} className={inkPill("md", ink, "mt-8 w-full")}>
                    {c.cta}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-8 text-center text-small text-muted">
            <Link href="/hi/pricing" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              प्लान में क्या-क्या मिलता है, पूरा देखें
            </Link>
          </p>
        </div>
      </section>

      <HiFaqSection id="faq" title="सवाल, सीधे जवाब।" items={HOME_FAQ} />
    </>
  );
}
