// Hindi copy for the /hi marketing pages. Every price and limit is read from the same constants as the English
// site (src/components/marketing/plans.ts → src/lib/billing/plans.ts), so the two languages can never disagree.
// Product names, prices and terms like SEO, AEO, GEO, ChatGPT stay in Latin script, the way Indians write them.
//
// Public offer (Website Blueprint, Nov 2026): two priced plans + Custom.
//   "Do it myself" (मैं ख़ुद करूँगा) = billing plan "starter", self-serve, free trial.
//   "Do it for me" (आप कर दीजिए)     = service tier "fix", our team does the work, no setup fee.
//   "Custom" (कस्टम — बात करें)      = big companies and agencies, no public price.
import {
  CUSTOM_CONTACT_HREF_HI, DFY_PLAN, MARKETING_PLANS, SELF_PLAN, SERVICE_TIERS, TRIAL_AI, TRIAL_DAYS,
  freq, inrGst, num, planSignupHref, priceNote, servicesContactHref,
  type PaidPlanId, type ServiceTierId,
} from "@/components/marketing/plans";

export const SOFTWARE_FROM = SELF_PLAN.price;

/* ------------------------------------------------------------------ the three public cards */

const weekly = (days: number) => (freq(days) === "Daily" ? "हर दिन" : freq(days) === "Weekly" ? "हर हफ़्ते" : "हर महीने");

/** "Do it myself" highlights, mirroring SELF_PLAN.highlights with the same limits. */
const SELF_HIGHLIGHTS = [
  "आपका Found Score, साथ में SEO, AEO, GEO और Brand स्कोर",
  `${weekly(SELF_PLAN.limits.minScanIntervalDays)} आपकी वेबसाइट का चेक, ${num(SELF_PLAN.limits.maxPagesPerCrawl)} पेज तक`,
  `ChatGPT जैसे ${SELF_PLAN.ai.engines} AI असिस्टेंट आपके बारे में क्या कहते हैं (हर महीने ${num(SELF_PLAN.ai.answersPerMonth)} AI जवाब)`,
  "आसान भाषा में काम की लिस्ट, सबसे ज़रूरी काम पहले",
  "WordPress पर एक क्लिक में सुधार, undo के साथ; दूसरी वेबसाइटों के लिए आसान copy-paste स्टेप",
  "हर महीने एक रिपोर्ट, जो 2 मिनट में पढ़ी जा सके",
];

/** "Do it for me" includes, in the same order as DFY_PLAN.includes. */
const DFY_INCLUDES = [
  "आपकी वेबसाइट ठीक की जाती है: जो भी चीज़ Google और AI को आप तक पहुँचने से रोकती है, सबसे ज़रूरी पहले",
  "आपकी Google Business Profile की देखभाल: समय, फ़ोटो, पोस्ट और रिव्यू के जवाब",
  "नए पेज और लेख, जो आपके ग्राहकों के सवालों का जवाब देते हैं",
  "AI जवाबों में आपका नाम: हम देखते हैं कि ChatGPT आपके बारे में क्या कहता है और गलत जानकारी ठीक करवाने पर काम करते हैं",
  "आपकी लिस्टिंग साफ़-सुथरी: हर बड़ी डायरेक्टरी पर एक ही नाम, पता और फ़ोन",
  "WhatsApp पर आपका अपना एक्सपर्ट, साथ में हर महीने आसान रिपोर्ट और कॉल",
];

/** Custom includes, in the same order as CUSTOM_PLAN.includes. */
const CUSTOM_INCLUDES = [
  "कई वेबसाइटें, ब्रांड, शहर या देश",
  "आपके लिए अलग टीम और बात करने के लिए एक ही व्यक्ति",
  "एजेंसियों के लिए आपके लोगो वाली रिपोर्ट",
  "API और डैशबोर्ड का एक्सेस",
];

export interface HindiOfferCard {
  key: "self" | "dfy" | "custom";
  /** Hindi name, e.g. "मैं ख़ुद करूँगा". */
  name: string;
  /** English name shown in brackets, e.g. "Do it myself". */
  en: string;
  /** INR excl. GST; null = no public price (Custom). */
  price: number | null;
  /** Shown instead of a price when price is null. */
  priceLabel?: string;
  line1: string;
  line2: string;
  /** Small print under the price. */
  terms: string;
  includes: string[];
  inherits?: string;
  cta: string;
  href: string;
  featured?: boolean;
  tag?: string;
}

export const HI_SELF: HindiOfferCard = {
  key: "self",
  name: "मैं ख़ुद करूँगा",
  en: SELF_PLAN.name,
  price: SELF_PLAN.price,
  line1: "हम आपको साफ़-साफ़ बताते हैं क्या ठीक करना है।",
  line2: `${TRIAL_DAYS} दिन फ्री। कार्ड की ज़रूरत नहीं। कभी भी बंद करें।`,
  terms: `${TRIAL_DAYS} दिन का फ्री ट्रायल, फिर हर महीने`,
  includes: SELF_HIGHLIGHTS,
  cta: `${TRIAL_DAYS} दिन फ्री आज़माएँ`,
  href: planSignupHref(SELF_PLAN.id),
};

export const HI_DFY: HindiOfferCard = {
  key: "dfy",
  name: "आप कर दीजिए",
  en: DFY_PLAN.name,
  price: DFY_PLAN.price,
  line1: "हमारी टीम सारा काम करती है।",
  line2: "फ्री 30 मिनट की कॉल। कोई सेटअप फ़ीस नहीं।",
  terms: `कोई सेटअप फ़ीस नहीं · ${DFY_PLAN.minimumMonths} महीने, फिर महीने-दर-महीने`,
  includes: DFY_INCLUDES,
  inherits: "“मैं ख़ुद करूँगा” की हर चीज़, और सारा काम हमारी टीम करती है:",
  cta: "फ्री कॉल बुक करें",
  href: `/hi${servicesContactHref(DFY_PLAN.id)}`,
  featured: true,
  tag: "सबसे ज़्यादा चुना गया",
};

export const HI_CUSTOM: HindiOfferCard = {
  key: "custom",
  name: "कस्टम — बात करें",
  en: "Custom",
  price: null,
  priceLabel: "बात करें",
  line1: "बड़ी कंपनियों और एजेंसियों के लिए।",
  line2: "आपके हिसाब से बना प्लान।",
  terms: "कीमत आपकी ज़रूरत के हिसाब से",
  includes: CUSTOM_INCLUDES,
  cta: "हमसे बात करें",
  href: CUSTOM_CONTACT_HREF_HI,
};

/** The three pricing cards, in display order (the middle one is the dark, featured card). */
export const HI_OFFER: HindiOfferCard[] = [HI_SELF, HI_DFY, HI_CUSTOM];

/* ------------------------------------------------------------------ software plan (HiPlanCards shape) */

export interface HindiPlan {
  id: PaidPlanId;
  name: string;
  price: number;
  suffix?: string;
  featured?: boolean;
  blurb: string;
  cta: string;
  highlights: string[];
}

export const HI_PLANS: HindiPlan[] = MARKETING_PLANS.map((p) => ({
  id: p.id,
  name: `${HI_SELF.name} (${p.name})`,
  price: p.price,
  suffix: p.suffix,
  featured: p.featured,
  blurb: HI_SELF.line1,
  cta: HI_SELF.cta,
  highlights: SELF_HIGHLIGHTS,
}));

/** "1 AI चेक: 10 सवाल × 3 AI असिस्टेंट" — the trial allowance, as the app enforces it. */
export const HI_TRIAL_AI = `${num(TRIAL_AI.checks)} AI चेक: ${TRIAL_AI.questions} सवाल × ${TRIAL_AI.engines} AI असिस्टेंट`;

/* ------------------------------------------------------------------ done-for-you (one offer) */

const TIER_COPY: Record<ServiceTierId, { blurb: string; inherits?: string; includes: string[]; updates: string; termNote?: string }> = {
  fix: {
    blurb: `${HI_DFY.line1} आप अपना बिज़नेस चलाइए।`,
    inherits: HI_DFY.inherits,
    includes: DFY_INCLUDES,
    updates: "हर महीने रिपोर्ट + कॉल",
    termNote: "फिर महीने-दर-महीने",
  },
};

export interface HindiServiceTier {
  id: ServiceTierId;
  name: string;
  price: number;
  setup: number;
  minimumMonths: number;
  featured?: boolean;
  blurb: string;
  inherits?: string;
  includes: string[];
  updates: string;
  termNote?: string;
}

export const HI_SERVICE_TIERS: HindiServiceTier[] = SERVICE_TIERS.map((t) => ({
  id: t.id,
  name: t.name,
  price: t.price,
  setup: t.setup,
  minimumMonths: t.minimumMonths,
  featured: t.featured,
  ...TIER_COPY[t.id],
}));

/* ------------------------------------------------------------------ FAQs (plain text: shown on the page and in FAQPage JSON-LD) */

export type HiFaq = { q: string; a: string };

export const HOME_FAQ: HiFaq[] = [
  {
    q: "SEO, AEO और GEO में क्या फ़र्क है?",
    a: "SEO का मतलब है कि Google आपकी वेबसाइट ढूँढ सके, पढ़ सके और उस पर भरोसा करे। AEO का मतलब है कि आपके पेज सवालों के छोटे और साफ़ जवाब दें, ताकि उन्हें कोट किया जा सके। GEO का मतलब है कि ChatGPT, Gemini जैसे AI असिस्टेंट आपका नाम लें और आपकी साइट का लिंक दें।",
  },
  {
    q: "क्या फ्री चेक के लिए साइन-अप करना पड़ता है?",
    a: "नहीं। अपनी वेबसाइट का पता डालें और करीब 30 सेकंड में 100 में से स्कोर और सबसे ज़रूरी सुधार देखें। कोई कार्ड या अकाउंट नहीं चाहिए।",
  },
  {
    q: "क्या आप मेरी वेबसाइट पर अपने-आप बदलाव कर देंगे?",
    a: "नहीं। हर बदलाव पहले आपको दिखाया जाता है और आपकी मंज़ूरी के बाद ही लाइव होता है। हर बदलाव को undo भी किया जा सकता है।",
  },
  {
    q: "कीमत कितनी है?",
    a: `“${HI_SELF.name}” (${HI_SELF.en}) ${inrGst(SOFTWARE_FROM)} महीना है और पहले ${TRIAL_DAYS} दिन फ्री हैं। अगर आप चाहते हैं कि सारा काम हमारी टीम करे, तो “${HI_DFY.name}” (${HI_DFY.en}) ${inrGst(DFY_PLAN.price)} महीना है, कोई सेटअप फ़ीस नहीं। बड़ी कंपनियों और एजेंसियों के लिए कस्टम प्लान है। ${priceNote(true)}`,
  },
  {
    q: "क्या आप Google पर पहला नंबर या ChatGPT में नाम आने की गारंटी देते हैं?",
    a: "नहीं। Google और AI क्या दिखाएँगे, यह कोई कंपनी तय नहीं कर सकती। हम ईमानदारी से मापते हैं, साफ़ सुधार बताते हैं और हर महीने दिखाते हैं कि क्या बदला।",
  },
];

export const PRICING_FAQ: HiFaq[] = [
  {
    q: "फ्री ट्रायल के बाद क्या होता है?",
    a: `${TRIAL_DAYS} दिन के ट्रायल में आपको पूरी वेबसाइट रिपोर्ट और ${HI_TRIAL_AI} मिलते हैं। कार्ड की ज़रूरत नहीं। पेड प्लान तभी शुरू होता है जब आप खुद “${HI_SELF.name}” चुनें और पेमेंट की जानकारी डालें।`,
  },
  {
    q: "एक AI जवाब क्या होता है?",
    a: `जब हम किसी एक AI असिस्टेंट से आपके ग्राहक का एक सवाल पूछते हैं, तो वह एक AI जवाब है। “${HI_SELF.name}” में हर महीने ${num(SELF_PLAN.ai.answersPerMonth)} AI जवाब मिलते हैं। ऐप दिखाता है कि कितने बचे हैं, वे हर महीने की 1 तारीख को फिर से भर जाते हैं, और सीमा पार होने से पहले चेक रुक जाता है।`,
  },
  {
    q: "क्या मैं “मैं ख़ुद करूँगा” से शुरू करके बाद में “आप कर दीजिए” ले सकता हूँ?",
    a: "हाँ। आपका पुराना डेटा, सवाल और रिपोर्ट साथ रहते हैं, इसलिए हमारी टीम आपके मौजूदा स्कोर से काम शुरू करती है। कोई सेटअप फ़ीस नहीं लगती।",
  },
  {
    q: "क्या किसी प्लान में नतीजों की गारंटी है?",
    a: "नहीं। “मैं ख़ुद करूँगा” में आपको चेक, काम की लिस्ट और सुधार के टूल मिलते हैं। “आप कर दीजिए” में हमारी टीम तय काम करती है — लेकिन Google पर जगह, AI में नाम या लिंक का वादा कोई ईमानदारी से नहीं कर सकता, और हम भी नहीं करते।",
  },
  {
    q: "क्या कीमतों में GST शामिल है?",
    a: "नहीं। सभी कीमतें भारतीय रुपये में हैं और GST लागू दर पर अलग से जुड़ता है।",
  },
];

export const SERVICES_FAQ: HiFaq[] = [
  {
    q: "“आप कर दीजिए” और “मैं ख़ुद करूँगा” में क्या फ़र्क है?",
    a: "“मैं ख़ुद करूँगा” में MyWebRank समस्याएँ ढूँढता है और सुधार का ड्राफ़्ट बनाता है, काम आप या आपकी टीम करती है। “आप कर दीजिए” में काम हमारी टीम करती है: हम आपके साथ प्लान तय करते हैं, हर महीने सुधार करते हैं और बताते हैं कि क्या बदला। लाइव डैशबोर्ड आपको तब भी मिलता है।",
  },
  {
    q: "क्या आप Google पर टॉप जगह या ChatGPT में नाम की गारंटी देते हैं?",
    a: "नहीं। Google या AI असिस्टेंट क्या दिखाएँगे, यह कोई तय नहीं कर सकता। जो जगह का वादा करता है, वह अंदाज़ा लगा रहा है। हम तय काम करते हैं और हर महीने ईमानदारी से दिखाते हैं कि क्या बदला।",
  },
  {
    q: "आपको मुझसे क्या चाहिए?",
    a: "आपकी वेबसाइट का एक्सेस, Google Business Profile पर मैनेजर रोल, पहले दो हफ़्तों में ग्राहकों के सवाल तय करने के लिए करीब एक घंटा, और जो बदलाव आपके बिज़नेस के बारे में सार्वजनिक बात बदलते हैं, उन पर जल्दी मंज़ूरी।",
  },
  {
    q: "क्या कोई सेटअप फ़ीस है?",
    a: `नहीं। “आप कर दीजिए” में कोई सेटअप फ़ीस नहीं है। आप सिर्फ़ ${inrGst(DFY_PLAN.price)} महीना देते हैं, कम से कम ${DFY_PLAN.minimumMonths} महीने, फिर महीने-दर-महीने।`,
  },
  {
    q: "कम से कम अवधि के बाद क्या होता है?",
    a: "प्लान महीने-दर-महीने चलता रहता है। आप 30 दिन का नोटिस देकर छोड़ सकते हैं। सारा कंटेंट, अकाउंट और रिपोर्ट आपके ही रहते हैं।",
  },
  {
    q: "क्या कीमतों में GST शामिल है?",
    a: "नहीं। सभी कीमतें भारतीय रुपये में हैं और GST लागू दर पर अलग से जुड़ता है।",
  },
];

export const FREE_CHECK_FAQ: HiFaq[] = [
  {
    q: "फ्री वेबसाइट चेक कैसे काम करता है?",
    a: "अपनी वेबसाइट का पता डालकर बटन दबाएँ। हम आपकी robots.txt फ़ाइल, sitemap, होमपेज और उससे जुड़े कुछ मुख्य पेज पढ़ते हैं। फिर पूरी रिपोर्ट वाले ही चेक चलाकर 0 से 100 तक के चार स्कोर और सबसे ज़रूरी सुधार दिखाते हैं। आम तौर पर इसमें आधा मिनट लगता है।",
  },
  {
    q: "चारों स्कोर का क्या मतलब है?",
    a: "SEO बताता है कि Google आपके पेज ढूँढकर दिखा सकता है या नहीं। AEO बताता है कि आपके पेज सवालों के साफ़ जवाब देते हैं या नहीं। GEO बताता है कि AI असिस्टेंट आपको पढ़ और समझ सकते हैं या नहीं। Brand बताता है कि आपके बिज़नेस की जानकारी, About और Contact पेज भरोसा जगाते हैं या नहीं।",
  },
  {
    q: "फ्री चेक और पूरी रिपोर्ट में क्या फ़र्क है?",
    a: `फ्री चेक कुछ ही पेज पढ़ता है और किसी AI असिस्टेंट से कुछ नहीं पूछता। पूरी रिपोर्ट “${HI_SELF.name}” (${HI_SELF.en}) प्लान पर हर चेक में ${num(SELF_PLAN.limits.maxPagesPerCrawl)} पेज तक पढ़ती है, और ChatGPT, Gemini जैसे AI से आपके ग्राहकों के असली सवाल पूछती है। यह प्लान ${TRIAL_DAYS} दिन के फ्री ट्रायल के बाद ${inrGst(SELF_PLAN.price)} महीना है।`,
  },
  {
    q: "क्या मेरी वेबसाइट पर यह चेक चलाना सुरक्षित है?",
    a: "हाँ। हम सिर्फ़ सार्वजनिक पेज पढ़ते हैं, ठीक वैसे ही जैसे कोई सर्च इंजन पढ़ता है, और आपकी वेबसाइट पर कुछ नहीं बदलते। हम आपकी robots.txt फ़ाइल के नियम मानते हैं और पढ़े गए पेज सेव नहीं करते।",
  },
];

export const ABOUT_FAQ: HiFaq[] = [
  {
    q: "MyWebRank की गाइड और ब्लॉग कौन लिखता है?",
    a: "MyWebRank की टीम। हमारी सलाह सर्च इंजनों और वेब स्टैंडर्ड संस्थाओं के सार्वजनिक दस्तावेज़ों पर, और असली वेबसाइटों पर हमारे अपने चेक के नतीजों पर आधारित होती है। हम मनगढ़ंत आँकड़े नहीं देते: हर नंबर हमारे प्रोडक्ट या किसी नामी स्रोत से आता है।",
  },
  {
    q: "क्या MyWebRank रैंकिंग या AI में नाम आने की गारंटी देता है?",
    a: "नहीं। Google किसी पेज को कहाँ रखेगा या AI असिस्टेंट क्या कहेगा, यह कोई तय नहीं कर सकता। हम ईमानदार माप, आसान भाषा में सुधार, और सिर्फ़ आपकी मंज़ूरी के बाद लाइव होने वाले बदलावों (undo के साथ) का वादा करते हैं।",
  },
];
