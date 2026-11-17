// Words for the contact form and contact card, in English and Hindi. Plain data (no React), so the client form,
// the server pages and the tests can all import it. /contact uses "en", /hi/contact uses "hi".

export type ContactLang = "en" | "hi";

/** One promise, used on the page, in the card and after the form is sent. */
export const REPLY_TIME: Record<ContactLang, string> = {
  en: "We reply within 1 working day, in English or Hindi.",
  hi: "हम 1 कामकाजी दिन के अंदर जवाब देते हैं, हिन्दी या अंग्रेज़ी में।",
};

export interface ContactFormCopy {
  name: string;
  email: string;
  company: string;
  /** Appended to the company label; English uses the Field's own "(optional)". */
  optionalSuffix: string;
  message: string;
  hintDefault: string;
  hintServices: string;
  hintCustom: string;
  /** Shown above the form when there is no calendar yet: the form is how to ask for a call. */
  callViaForm: string;
  topicServices: string;
  topicCustom: string;
  send: string;
  sending: string;
  errName: string;
  errEmail: string;
  errMessage: string;
  errCaptcha: string;
  errServer: (email: string) => string;
  errNetwork: (email: string) => string;
  sentTitle: string;
  sentBody: (email: string) => string;
  whatsapp: string;
  newTab: string;
  honeypot: string;
}

export const CONTACT_FORM_COPY: Record<ContactLang, ContactFormCopy> = {
  en: {
    name: "Name",
    email: "Email",
    company: "Business name",
    optionalSuffix: "",
    message: "How can we help?",
    hintDefault: "E.g. which plan suits you, or what you'd like to know.",
    hintServices: "Add your website and what you'd like help with. We'll reply to fix a time.",
    hintCustom: "Tell us roughly how many websites, brands or cities, and what you need.",
    callViaForm: "Want a free 30-minute call? Ask here: write your website and a good time, and we'll reply to fix it.",
    topicServices: "Topic: Do it for me",
    topicCustom: "Topic: Custom plan",
    send: "Send message",
    sending: "Sending…",
    errName: "Please tell us your name.",
    errEmail: "Enter a valid email address.",
    errMessage: "Please write a little more (at least 10 characters).",
    errCaptcha: "Please complete the security check.",
    errServer: (email) => `Something went wrong. Please email ${email} instead.`,
    errNetwork: (email) => `We couldn't reach our server. Please email ${email} instead.`,
    sentTitle: "Thanks — your message is on its way",
    sentBody: (email) => `We will write back to ${email}.`,
    whatsapp: "Chat on WhatsApp",
    newTab: "(opens in a new tab)",
    honeypot: "Leave this empty",
  },
  hi: {
    name: "नाम",
    email: "ईमेल",
    company: "बिज़नेस का नाम",
    optionalSuffix: " (ज़रूरी नहीं)",
    message: "हम आपकी क्या मदद करें?",
    hintDefault: "जैसे: आपके लिए कौन-सा प्लान ठीक रहेगा, या आप क्या जानना चाहते हैं।",
    hintServices: "अपनी वेबसाइट और जिस काम में मदद चाहिए, वह लिखें। हम समय तय करने के लिए जवाब देंगे।",
    hintCustom: "मोटे तौर पर बताइए कितनी वेबसाइटें, ब्रांड या शहर हैं, और आपको क्या चाहिए।",
    callViaForm: "30 मिनट की फ्री कॉल चाहिए? यहीं लिखें: अपनी वेबसाइट और सही समय बताइए, हम जवाब देकर समय तय करेंगे।",
    topicServices: "विषय: आप कर दीजिए (Do it for me)",
    topicCustom: "विषय: कस्टम प्लान",
    send: "मैसेज भेजें",
    sending: "भेजा जा रहा है…",
    errName: "कृपया अपना नाम लिखें।",
    errEmail: "सही ईमेल पता लिखें।",
    errMessage: "कृपया थोड़ा और लिखें (कम से कम 10 अक्षर)।",
    errCaptcha: "कृपया सुरक्षा जाँच पूरी करें।",
    errServer: (email) => `कुछ गड़बड़ हो गई। कृपया ${email} पर ईमेल करें।`,
    errNetwork: (email) => `हम अपने सर्वर तक नहीं पहुँच पाए। कृपया ${email} पर ईमेल करें।`,
    sentTitle: "धन्यवाद — आपका मैसेज हमें मिल रहा है",
    sentBody: (email) => `हम ${email} पर जवाब भेजेंगे।`,
    whatsapp: "WhatsApp पर बात करें",
    newTab: "(नए टैब में खुलता है)",
    honeypot: "इसे खाली छोड़ें",
  },
};

/** Message prefill for /contact?topic=services (optionally &tier=fix → "Do it for me"). */
export function servicesPrefill(lang: ContactLang, tierName?: string): string {
  if (lang === "hi") {
    return `विषय: आप कर दीजिए (Do it for me)

मुझे फ्री कॉल बुक करनी है। हमारी वेबसाइट:
हमें सबसे ज़्यादा किस काम में मदद चाहिए: `;
  }
  return `Topic: Done-for-you services${tierName ? ` (${tierName})` : ""}

I'd like to book a free call. Our website is:
What we'd most like help with: `;
}

/** Message prefill for /contact?topic=custom. */
export function customPrefill(lang: ContactLang): string {
  if (lang === "hi") {
    return `विषय: कस्टम प्लान

कितनी वेबसाइटें, ब्रांड या शहर:
हमें क्या चाहिए (जैसे हमारे लोगो वाली रिपोर्ट, API या डैशबोर्ड): `;
  }
  return `Topic: Custom plan

How many websites, brands or cities:
What we need (e.g. reports with our logo, API or dashboard access): `;
}
