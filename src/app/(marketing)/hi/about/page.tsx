import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/billing/plans";
import { LEGAL_ENTITY } from "@/lib/site";
import { faqLd, siteUrl } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { ENGINES, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SERVICE_FROM_PRICE, TRIAL_DAYS, inr, num } from "@/components/marketing/plans";
import { ABOUT_FAQ } from "@/components/marketing/hi/content";
import { HiFaqSection, HiFinalCta } from "@/components/marketing/hi/hi-ui";
import { hiWebPageLd } from "@/components/marketing/hi/seo";

export const metadata: Metadata = staticPageMetadata("/hi/about");

const engineList = `${ENGINES.slice(0, -1).join(", ")} और ${ENGINES[ENGINES.length - 1]}`;

export default function HindiAboutPage() {
  const base = siteUrl();
  const starter = PLANS.starter;
  return (
    <>
      <JsonLd
        data={[
          hiWebPageLd("/hi/about", { type: "AboutPage", name: `${BRAND.name} के बारे में`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } }),
          faqLd(ABOUT_FAQ),
        ]}
      />
      <PageHero
        eyebrow="हमारे बारे में"
        title={`${BRAND.name} के बारे में`}
        intro={
          <p>
            {BRAND.name} बिज़नेस को Google पर मिलने और AI असिस्टेंट के जवाबों में नाम आने में मदद करता है। यहाँ जानिए कि हम कौन हैं, क्या करते
            हैं, कैसे मापते हैं और हमसे कैसे संपर्क करें।
          </p>
        }
      />

      <Section labelledBy="hi-about-who">
        <div className="mx-auto max-w-3xl space-y-10 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <div>
            <h2 id="hi-about-who" className="text-h3 text-fg">
              {BRAND.name} के पीछे कौन है?
            </h2>
            <p className="mt-3">
              {BRAND.name}, {BRAND.domain} पर चलने वाला SEO, AEO और GEO प्लेटफ़ॉर्म है। यह {LEGAL_ENTITY} का प्रोडक्ट है और भारत की एक टीम इसे
              बनाती और चलाती है। हम ऐसा सॉफ़्टवेयर बनाते हैं जो Google और AI सर्च के लिए वेबसाइटों की जाँच करता है, और उन बिज़नेस के लिए सेवा
              भी देते हैं जो चाहते हैं कि काम हम ही कर दें।
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">{BRAND.name} क्या करता है?</h2>
            <p className="mt-3">
              हम देखते हैं कि कोई वेबसाइट Google, आंसर इंजन और AI असिस्टेंट के लिए कितनी तैयार है, और जब ग्राहक सवाल पूछते हैं तो {engineList}{" "}
              कितनी बार उस ब्रांड का नाम लेते हैं। फिर हम आसान भाषा में सुधार बताते हैं और आपकी मंज़ूरी से उनमें से कई खुद लाइव कर देते हैं।
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-fg">वेबसाइट जाँच:</strong> {starter.name} प्लान पर हर चेक {num(starter.maxPagesPerCrawl)} पेज
                तक पढ़ता है; Growth प्लान {num(PLANS.growth.maxPagesPerCrawl)} तक और Agency प्लान {num(PLANS.agency.maxPagesPerCrawl)} तक।
              </li>
              <li>
                <strong className="font-semibold text-fg">AI में दिखने की जाँच:</strong> हम आपके ग्राहकों के सवाल {ENGINES.length} तक AI असिस्टेंट से
                पूछते हैं और दर्ज करते हैं कि आपका नाम आया, लिंक मिला या आप छूट गए।
              </li>
              <li>
                <strong className="font-semibold text-fg">सॉफ़्टवेयर प्लान:</strong> पेड प्लान {inr(starter.priceInrMonthly ?? 0)} महीने से शुरू होते हैं,
                और पहले {TRIAL_DAYS} दिन आप इसे फ्री आज़मा सकते हैं।
              </li>
              <li>
                <strong className="font-semibold text-fg">सेवा:</strong> हमारी टीम आपके लिए काम करती है, {inr(SERVICE_FROM_PRICE)} महीने से, GST अलग।
                देखें <Link href="/hi/services">सेवाएँ</Link>।
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-h3 text-fg">{BRAND.name} वेबसाइट को कैसे मापता है?</h2>
            <p className="mt-3">
              हम आपके पेज वैसे ही पढ़ते हैं जैसे सर्च इंजन पढ़ते हैं, आपकी robots.txt के नियम मानते हैं, और चार हिस्सों — SEO, AEO, GEO और
              Brand — को 0 से 100 तक स्कोर करते हैं। AI में दिखना हम AI असिस्टेंट से ग्राहकों के असली सवाल पूछकर और यह गिनकर मापते हैं कि
              आपका नाम और लिंक कितनी बार आया। हमारे चेक Google की SEO Starter Guide, schema.org और robots.txt स्टैंडर्ड (RFC 9309) जैसे
              सार्वजनिक नियमों पर आधारित हैं।
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">क्या {BRAND.name} और MyWebRank S.L. या getmywebrank.com एक ही हैं?</h2>
            <p className="mt-3">
              नहीं। {BRAND.name} ({BRAND.domain}) का स्पेन की MyWebRank S.L. या getmywebrank.com से कोई संबंध नहीं है। हमारी वेबसाइट{" "}
              {BRAND.domain} है। अगर कोई AI असिस्टेंट या डायरेक्टरी हमें किसी और कंपनी से मिला दे, तो कृपया हमें बताएँ ताकि हम उसे ठीक करवा सकें।
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">{BRAND.name} से संपर्क कैसे करें?</h2>
            <p className="mt-3">
              <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> पर ईमेल करें या हमारा <Link href="/hi/contact">संपर्क फ़ॉर्म</Link>{" "}
              भरें। हर मैसेज हमारी टीम का कोई असली व्यक्ति पढ़ता है — चाहे साइन-अप से पहले का सवाल हो, एजेंसी प्लान की बात हो या आपकी रिपोर्ट में
              मदद चाहिए। आप हिन्दी या अंग्रेज़ी, किसी में भी लिख सकते हैं।
            </p>
          </div>
        </div>
      </Section>

      <HiFaqSection id="faq" title="हम कैसे काम करते हैं" items={ABOUT_FAQ} />

      <HiFinalCta
        title="देखिए कि Google और AI आपकी वेबसाइट को कैसे देखते हैं।"
        body={<p>फ्री वेबसाइट चेक चलाइए — कोई साइन-अप नहीं — या {TRIAL_DAYS} दिन का फ्री ट्रायल शुरू कीजिए।</p>}
      />
    </>
  );
}
