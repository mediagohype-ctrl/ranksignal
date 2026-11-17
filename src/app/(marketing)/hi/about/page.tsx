import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { siteUrl } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/marketing/ui";
import { AboutBody, type AboutCopy } from "@/components/marketing/about-ui";
import { HI_DFY } from "@/components/marketing/hi/content";
import { hiWebPageLd } from "@/components/marketing/hi/seo";

export const metadata: Metadata = staticPageMetadata("/hi/about");

// Hindi About page: the same short shape as /about (headline, proof line, 3-line story, 3 beliefs, one button).
const COPY: AboutCopy = {
  eyebrow: "हमारे बारे में",
  title: "हम बिज़नेस को Google और AI पर दिखने में मदद करते हैं।",
  // BRAND.proof ("10,000+ businesses served by our team") in Hindi — the same owner-confirmed figure.
  proof: "हमारी टीम 10,000+ बिज़नेस के लिए काम कर चुकी है",
  storyTitle: "हमने इसे क्यों बनाया",
  story: [
    "आज लोग Google और ChatGPT जैसे AI से पूछते हैं कि किससे ख़रीदें।",
    "ज़्यादातर बिज़नेस मालिक नहीं जान पाते कि वे वहाँ दिखते हैं या नहीं, और क्या बदलना है।",
    `${BRAND.name} आपकी वेबसाइट चेक करता है और आसान भाषा में बताता है कि क्या ठीक करना है। अगर आप ख़ुद नहीं करना चाहते, तो भारत में हमारी टीम यह काम कर देती है।`,
  ],
  beliefsTitle: "तीन बातें जिन पर हम भरोसा करते हैं",
  beliefs: [
    { title: "आसान भाषा", body: "हर समस्या के साथ बताया जाता है कि क्या गड़बड़ है और उसे कैसे ठीक करें — ऐसे शब्दों में जो कोई भी दुकानदार समझ सके।" },
    { title: "ईमानदार नंबर", body: "Google या AI के जवाब किसी के हाथ में नहीं हैं, इसलिए हम किसी जगह का वादा नहीं करते। हम मापते हैं और दिखाते हैं कि क्या बदला।" },
    {
      title: "फ़ैसला आपका",
      body: `आपकी वेबसाइट पर आपकी हाँ के बिना कुछ नहीं बदलता। सुधार आप हमारे बताए कदमों से ख़ुद करते हैं, या “${HI_DFY.name}” (${HI_DFY.en}) में हमारी टीम कर देती है।`,
    },
  ],
  ctaTitle: "देखिए कि Google और AI आपके बिज़नेस को कैसे देखते हैं।",
  cta: { label: "मेरी वेबसाइट फ्री में चेक करें", href: "/hi/free-check" },
  contact: { before: "कोई सवाल, कस्टम प्लान या अपनी रिपोर्ट में मदद चाहिए? ", label: "असली इंसान से बात करें", href: "/hi/contact", after: "।" },
  productOf: (brand, legalName) => `${brand}, ${legalName} का प्रोडक्ट है।`,
  gstLabel: "GST नंबर",
  officeLabel: "ऑफ़िस",
  notRelated: `${BRAND.name} (${BRAND.domain}) का स्पेन की MyWebRank S.L. या getmywebrank.com से कोई संबंध नहीं है।`,
};

export default function HindiAboutPage() {
  const base = siteUrl();
  return (
    <>
      <JsonLd data={hiWebPageLd("/hi/about", { type: "AboutPage", name: `${BRAND.name} के बारे में`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } })} />
      <AboutBody copy={COPY} />
    </>
  );
}
