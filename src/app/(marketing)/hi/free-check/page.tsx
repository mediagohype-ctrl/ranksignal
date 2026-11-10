import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bot, MessageSquareQuote, Search, ShieldCheck, Sparkles } from "lucide-react";
import { CheckLanes, type Lane } from "@/components/marketing/showcase/check-lanes";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FreeCheckTool } from "@/components/marketing/free-check-tool";
import { SectionHeading } from "@/components/ui";
import { FREE_CHECK_FAQ } from "@/components/marketing/hi/content";
import { EnglishNote, HiFaqSection } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { faqLd, siteUrl } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/hi/free-check");

const WHAT: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Search />, title: "SEO की बुनियाद", body: "Google पर दिखने वाली हेडलाइन और समरी, मुख्य हेडिंग, सुरक्षित पता (ताले का निशान), और क्या आपके पेज Google पर आ सकते हैं।" },
  { icon: <Sparkles />, title: "जवाब देने की तैयारी (AEO)", body: "क्या आपके पेज ग्राहकों के असली सवालों के जवाब इतने साफ़ देते हैं कि उन्हें कोट किया जा सके।" },
  { icon: <Bot />, title: "AI की पहुँच (GEO)", body: "क्या ChatGPT, Perplexity और Claude के रोबोट आपकी साइट पढ़ सकते हैं, और क्या AI समझ पाता है कि आप कौन हैं।" },
  { icon: <ShieldCheck />, title: "भरोसे के निशान", body: "आपके बिज़नेस की जानकारी, About और Contact पेज, और आपके सोशल प्रोफ़ाइल के लिंक।" },
];

const LANES: Lane[] = [
  {
    tag: "SEO",
    title: "Google सर्च",
    line: "क्या Google आपके पेज ढूँढ पाता है और आपके नाम के नीचे साफ़ हेडलाइन और समरी दिखाता है?",
    icon: <Search />,
    checks: ["Google पर दिखने वाली हेडलाइन और समरी", "मुख्य हेडिंग और सुरक्षित ताले का निशान", "Google पर आने की इजाज़त, और आपका साइटमैप"],
    mock: { kind: "search", query: "मेरे पास केक की दुकान", site: "yourbusiness.example", title: "आपका बिज़नेस · आपके इलाके में ताज़ा केक" },
  },
  {
    tag: "AEO",
    title: "जवाब वाले बॉक्स",
    line: "क्या आपके पेज ग्राहकों के असली सवालों का छोटा, साफ़ जवाब देते हैं जिसे कोट किया जा सके?",
    icon: <MessageSquareQuote />,
    checks: ["पेज पर छोटे, सीधे जवाब", "सवाल वाली हेडिंग और FAQ", "बिज़नेस की जानकारी जो Google पढ़ सके"],
    mock: { kind: "answer", heading: "जवाब", answer: "हाँ, वे पूरे शहर में रोज़ रात 8 बजे तक डिलीवरी करते हैं।", source: "yourbusiness.example से" },
  },
  {
    tag: "GEO",
    title: "AI असिस्टेंट",
    line: "क्या ChatGPT, Perplexity और Claude आपकी वेबसाइट पढ़ पाते हैं और समझ पाते हैं कि आप कौन हैं?",
    icon: <Bot />,
    checks: ["robots.txt में AI रोबोट को इजाज़त", "आप कौन हैं और क्या करते हैं, साफ़ शब्दों में", "AI गाइड फ़ाइल (llms.txt), अगर आपके पास है"],
    mock: { kind: "chat", question: "मेरे पास केक कौन डिलीवर करता है?", before: "आप", name: "आपका बिज़नेस", after: "आज़मा सकते हैं — वे उसी दिन डिलीवर करते हैं।" },
  },
];

export default async function HindiFreeCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initialUrl = typeof sp.url === "string" ? sp.url.slice(0, 2048) : "";
  const base = siteUrl();
  const appLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${BRAND.name} फ्री वेबसाइट चेक`,
    url: `${base}/hi/free-check`,
    inLanguage: "hi-IN",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: PAGE_SEO["/hi/free-check"].description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    provider: { "@id": `${base}/#organization` },
  };

  return (
    <>
      <JsonLd data={[appLd, hiWebPageLd("/hi/free-check", { base }), faqLd(FREE_CHECK_FAQ)]} />
      <PageHero
        eyebrow="फ्री टूल"
        title="फ्री वेबसाइट SEO चेकर: क्या आपकी साइट Google और AI के लिए तैयार है?"
        intro={
          <p>
            अपनी वेबसाइट का पता डालें। हम आपका होमपेज और चार तक मुख्य पेज पढ़कर उन्हें SEO, आंसर इंजन (AEO) और AI असिस्टेंट (GEO) के
            लिए स्कोर करते हैं — साथ में आपके टॉप 3 सुधार, आसान शब्दों में।
          </p>
        }
      />
      <section aria-label="फ्री चेक चलाएँ" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing">
          {/* The tool and its results are in English for now; the surrounding page is Hindi. */}
          <div lang="en">
            <FreeCheckTool initialUrl={initialUrl} />
          </div>
          <EnglishNote>
            ध्यान दें: यह चेक टूल और इसके नतीजे अभी अंग्रेज़ी में दिखते हैं। स्कोर और सुधार वही हैं जो अंग्रेज़ी पेज पर मिलते हैं।
          </EnglishNote>
        </div>
      </section>
      <Section labelledBy="hi-fc-lanes">
        <SectionHeading
          id="hi-fc-lanes"
          size="lg"
          align="center"
          eyebrow="SEO, AEO और GEO"
          title="तीन जगहें जहाँ ग्राहक आपको ढूँढते हैं"
          description={
            <>
              SEO यानी Google पर मिलना। AEO (आंसर इंजन ऑप्टिमाइज़ेशन) यानी वह छोटा जवाब बनना जिसे Google और वॉइस असिस्टेंट कोट करते हैं। GEO
              (जनरेटिव इंजन ऑप्टिमाइज़ेशन) यानी ChatGPT और Gemini जैसे AI असिस्टेंट के जवाब में आपका नाम आना। फ्री चेक आपकी वेबसाइट को
              तीनों के लिए स्कोर करता है, साथ में Brand के लिए भी।
            </>
          }
        />
        <CheckLanes
          site="yourbusiness.com"
          siteNote={`हम आपका होमपेज और ${MAX_KEY_PAGES} तक मुख्य पेज पढ़ते हैं`}
          lanes={LANES}
          caption="हर जगह के लिए फ्री चेक क्या देखता है। छोटी तस्वीरें सिर्फ़ उदाहरण हैं, आपके नतीजे नहीं।"
        />
      </Section>
      <Section labelledBy="hi-fc-what" tone="surface">
        <SectionHeading id="hi-fc-what" size="lg" align="center" eyebrow="हम क्या चेक करते हैं" title="फ्री चेक किन चीज़ों को देखता है" />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHAT.map((w) => (
            <li key={w.title} className="rounded-2xl border border-border bg-bg p-6">
              <IconTile>{w.icon}</IconTile>
              <h3 className="mt-4 text-h4 text-fg">{w.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{w.body}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-small text-muted">
          यह फ्री चेक सिर्फ़ आपकी वेबसाइट पढ़ता है। यह ChatGPT से <strong className="font-semibold text-fg">नहीं</strong> पूछता — वह
          पूरा चेक करता है, साइन-अप के बाद। हम पढ़े गए पेज कभी सेव नहीं करते।
        </p>
      </Section>
      <HiFaqSection id="faq" title="फ्री चेक से जुड़े सवाल" items={FREE_CHECK_FAQ} />
    </>
  );
}
