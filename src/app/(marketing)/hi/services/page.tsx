import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { SERVICE_FROM_PRICE, inr } from "@/components/marketing/plans";
import { HI_SERVICE_TIERS, SERVICES_FAQ } from "@/components/marketing/hi/content";
import { HiFaqSection, HiTierCards } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { faqLd, siteUrl } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/services", {
  keywords: ["SEO कंपनी", "SEO सेवा", "भारत में SEO", "AEO", "GEO", "ChatGPT में नाम"],
});

const STEPS = [
  { title: "फ्री कॉल", body: "30 मिनट में हम साथ बैठकर आपकी वेबसाइट और AI के जवाब देखते हैं, और बताते हैं कि पहले क्या ठीक करना चाहिए।" },
  { title: "प्लान तय", body: "आपके ग्राहक कौन-से सवाल पूछते हैं, यह तय करके हम हर महीने के सुधारों की लिस्ट बनाते हैं।" },
  { title: "हर महीने काम", body: "हमारी टीम सुधार करती है। जो भी बदलाव आपके बिज़नेस के बारे में सार्वजनिक बात बदलता है, वह आपकी मंज़ूरी के बाद ही लाइव होता है।" },
  { title: "हर महीने रिपोर्ट", body: "आपको साफ़ रिपोर्ट मिलती है: क्या किया, स्कोर कितने बदले, और AI जवाबों में आपका नाम कितनी बार आया।" },
];

const PROMISES = [
  { title: "कम अवधि, फिर 30 दिन का नोटिस", body: "काम को सही मौका देने के लिए तीन या छह महीने, फिर महीने-दर-महीने। 30 दिन का नोटिस देकर छोड़ें, कोई एग्ज़िट फ़ीस नहीं।" },
  { title: "काम की गारंटी", body: "अगर किसी महीने हमने वादा किए सुधार नहीं किए, तो उस महीने की फ़ीस का 25% वापस। एक्सेस या मंज़ूरी के इंतज़ार की देरी इसमें नहीं गिनी जाती।" },
  { title: "Google या AI में जगह का वादा नहीं। कभी नहीं।", body: "AI के जवाब दूसरी कंपनियों के सिस्टम लिखते हैं। जो जगह की गारंटी देता है, वह अंदाज़ा लगा रहा है। हम काम की गारंटी देते हैं और ईमानदारी से दिखाते हैं कि क्या बदला।" },
];

export default function HindiServicesPage() {
  const base = siteUrl();
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "SEO, AEO और GEO सेवा (हमारी टीम करती है)",
    serviceType: "AI search visibility (SEO, AEO and GEO) management",
    description: PAGE_SEO["/hi/services"].description,
    url: `${base}/hi/services`,
    inLanguage: "hi-IN",
    areaServed: { "@type": "Country", name: "India" },
    provider: { "@type": "Organization", "@id": `${base}/#organization`, name: BRAND.name, url: base },
    offers: HI_SERVICE_TIERS.map((t) => ({
      "@type": "Offer",
      name: `${t.name} (done-for-you)`,
      url: `${base}/hi/services#plans`,
      price: String(t.price),
      priceCurrency: "INR",
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(t.price), priceCurrency: "INR", unitCode: "MON", valueAddedTaxIncluded: false },
    })),
  };

  return (
    <>
      <JsonLd data={[hiWebPageLd("/hi/services", { base }), serviceLd, faqLd(SERVICES_FAQ)]} />

      <section aria-labelledby="hi-services-title" className="border-b border-border">
        <div className="container-marketing pb-14 pt-14 sm:pb-20 sm:pt-20">
          <h1 id="hi-services-title" className="mk-label mk-rise">
            भारत की SEO कंपनी: SEO, AEO और GEO सेवा
          </h1>
          <p className="mk-hero mk-rise mt-5 max-w-[18ch] text-fg">काम हम करते हैं। फ़ैसला आपका।</p>
          <p className="mk-lead mk-rise mk-delay-1 mt-8 max-w-[40rem] text-fg-soft">
            भारत की हमारी टीम हर महीने आपकी वेबसाइट और Google लिस्टिंग ठीक करती है, ताकि Google पर ग्राहक आपको ढूँढ सकें और ChatGPT
            जैसे AI आपका नाम लें। {inr(SERVICE_FROM_PRICE)} महीने से, GST अलग।
          </p>
          <div className="mk-rise mk-delay-2 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/hi/contact?topic=services" className={inkPill("lg")}>
              फ्री स्ट्रैटेजी कॉल बुक करें
              <ArrowRight aria-hidden />
            </Link>
            <Link
              href="/hi/free-check"
              className="inline-flex h-14 items-center justify-center rounded-full border border-border-strong px-7 text-[1rem] font-medium text-fg hover:bg-surface-2"
            >
              पहले फ्री चेक चलाएँ
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="hi-how-title" className="py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="hi-how-title" className="mk-title max-w-[18ch] text-fg">
            यह कैसे काम करता है
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-fg pt-6">
                <span aria-hidden className="text-small font-medium tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[1.375rem] font-semibold text-fg">{s.title}</h3>
                <p className="mk-body mt-3 text-fg-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="plans" aria-labelledby="hi-plans-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing">
          <p className="mk-label">प्लान</p>
          <h2 id="hi-plans-title" className="mk-title mt-4 max-w-[20ch] text-fg">
            तीन प्लान। कीमतें रुपये में, GST अलग।
          </h2>
          <div className="mt-12">
            <HiTierCards tiers={HI_SERVICE_TIERS} />
          </div>
        </div>
      </section>

      <section aria-labelledby="hi-promises-title" className="py-20 sm:py-28">
        <div className="container-marketing">
          <h2 id="hi-promises-title" className="mk-title max-w-[18ch] text-fg">
            हमारे वादे
          </h2>
          <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {PROMISES.map((p) => (
              <li key={p.title} className="border-t border-fg pt-6">
                <h3 className="text-[1.25rem] font-semibold text-fg">{p.title}</h3>
                <p className="mk-body mt-3 text-fg-soft">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HiFaqSection id="faq" title="सेवा से जुड़े सवाल" items={SERVICES_FAQ} />
    </>
  );
}
