// Every word the free-check tool and its result show, in English and Hindi. Pure (no React, no I/O), so the
// client components and the tests share it. The Hindi page passes lang="hi"; nothing else changes.
// Product names and terms like SEO, AEO, GEO, Found Score and ChatGPT stay in Latin script, the way the rest of
// the Hindi pages write them (src/components/marketing/hi/content.ts).
import type { IssueEffort, IssueImpact, Pillar } from "@/lib/report/types";

export type FreeCheckLang = "en" | "hi";
export type ScoreBandKey = "good" | "ok" | "poor";

/** English shows the error message the server sent, so it has no text per error code. */
const serverMessage: (code: string | undefined) => string | null = () => null;

const EN = {
  /* ---- the tool (form + progress) ---- */
  sectionLabel: "Run the free check",
  fieldLabel: "Your website",
  fieldHint: "Your homepage address, e.g. yourbusiness.com",
  footnote: "Free · no sign-up · we only read your public pages.",
  run: "Check my website free",
  runAgain: "Check again",
  checking: "Checking…",
  progressLabel: "Free check progress",
  duration: "This usually takes 10–25 seconds.",
  steps: {
    security: "Quick security check",
    home: "Read your homepage",
    robots: "Check that AI robots can get in",
    pages: "Read your main pages",
    score: "Work out your scores",
  },
  securityWaiting: "One quick security check, then your check starts by itself.",
  securityTick: "Tick the security box above and your check starts by itself.",
  checkedFor: (host: string) => `Result for ${host}`,
  checkAnother: "Check another website",
  errEmptyUrl: "Type your website address, like yourbusiness.com.",
  errCaptcha: "Tick the security check above the button, then try again.",
  errGeneric: "Something went wrong on our side. Please try again in a minute.",
  errNetwork: "We couldn't reach our server. Check your connection and try again.",
  /** Server errors by code. English uses the server's own message (null here). */
  serverError: serverMessage,

  /* ---- hourly limit reached: how to start the free trial, in three easy steps ---- */
  limitTitle: "You've used your free checks for this hour",
  limitIntro: "Start your 7-day free trial to check your website as often as you like and see every fix. It's easy:",
  limitSteps: [
    "Tap \"Start my free trial\" below.",
    "Sign up with Google or your email. It takes 1 minute, and no card is needed.",
    "We check your website for you. Your full report and every fix are ready in a few minutes.",
  ],
  limitCta: "Start my free trial",
  limitLater: "Or come back in an hour for another free check.",

  /* ---- check failed: never a dead end ---- */
  failTitle: "We couldn't read this website right now",
  failBody: "Get your report on WhatsApp instead. Our team will check it by hand and send it to you today.",
  failTryAgain: "Try again",

  /* ---- WhatsApp unlock box ---- */
  waTitle: "Your full report is ready",
  waIntro: "Get every fix, step by step, on WhatsApp.",
  waLabel: "WhatsApp number",
  waPlaceholder: "98765 43210",
  waButton: "Send it to my WhatsApp",
  waSaving: "Sending…",
  waInvalid: "Enter your 10-digit WhatsApp number, like 98765 43210.",
  waFailed: "We couldn't save your number just now. Please try again in a minute.",
  waNetwork: "We couldn't reach our server. Check your connection and try again.",
  waNote: "We only use your number to send this report. No spam.",
  waThanks: (num: string) => `Done! Your report is on its way to +91 ${num}.`,
  waThanksFailed: (num: string) => `Thanks! Our team will send your report to +91 ${num} on WhatsApp today.`,
  waThanksNext: "Want to see every fix right now? Start your free trial.",

  /* ---- result: score ---- */
  overallName: "Found Score",
  overallLabel: "Your Found Score",
  eyebrow: (host: string) => `Your Found Score · ${host}`,
  bandLabel: { good: "Good", ok: "Needs work", poor: "Poor" } as Record<ScoreBandKey, string>,
  notChecked: "Not checked yet",
  basedOn: (pages: number) => `Based on ${pages} page${pages === 1 ? "" : "s"} we read just now`,
  basedOnFor: " for ",

  /* ---- result: four scores ---- */
  fourScores: "Your four scores",
  fourScoresCaption: "Each area is scored from 0 to 100. Green is good, yellow needs work, red is poor.",
  pillarName: {
    seo: "SEO · Google Score",
    aeo: "AEO · Answer Score",
    geo: "GEO · AI Score",
    brand: "Brand · Trust Score",
  } as Record<Pillar, string>,
  pillarQuestion: {
    seo: "Can Google find and show your pages?",
    aeo: "Do your pages answer questions clearly enough to be quoted?",
    geo: "Can AI assistants like ChatGPT read and understand you?",
    brand: "Are your business details easy to find and trust?",
  } as Record<Pillar, string>,
  /** "Poor: 0 of 7 pass. 3 matter most." */
  pillarSummary: (band: ScoreBandKey, pass: number, total: number, fail: number) =>
    `${EN.bandLabel[band]}: ${pass} of ${total} pass.${fail ? ` ${fail} matter${fail === 1 ? "s" : ""} most.` : ""}`,
  /** GEO and Brand: the free check never asks AI, so say what the number covers instead of "waiting". */
  websiteOnly: "From your website only. The full check also asks ChatGPT.",
  fullCheckOnly: "Full check",
  notMeasuredAi: "Shown in the full check — we ask ChatGPT, Gemini and others about you after you sign up.",
  notMeasured: "We couldn't measure this from the pages we read.",
  meterLabel: (name: string) => `${name} score`,

  /* ---- result: what this means ---- */
  meaning: "What this means",
  meaningCaption: "Where your score sits: Poor is below 50, Needs work is 50 to 74, Good is 75 and up.",
  you: (n: number) => `You: ${n}`,
  inRange: (n: number, band: ScoreBandKey) => `Your score of ${n} is in the ${EN.bandLabel[band]} range.`,
  bandMeaning: {
    poor: "Google and AI assistants struggle to understand your website. The fixes below are the quickest way up.",
    ok: "Some of the basics are in place, but gaps make it harder for Google and AI to pick you.",
    good: "Your pages cover the basics well. The full check looks for the next wins, including what ChatGPT says about you.",
  } as Record<ScoreBandKey, string>,
  couldAdd: (fixes: number, gain: number, after: number) =>
    `Your top ${fixes === 1 ? "fix" : `${fixes} fixes`} could add about ${gain} point${gain === 1 ? "" : "s"}, taking you to around ${after}.`,
  goodAway: (n: number) => `Good starts at 75, which is ${n} point${n === 1 ? "" : "s"} away.`,

  /* ---- result: fixes ---- */
  fixesTitle: (n: number) => (n ? `Your top ${n === 1 ? "fix" : `${n} fixes`}` : "No big problems found"),
  fixesIntro: "Biggest gain first. Tap a fix to see how.",
  noFixesIntro: "Nice work — the pages we read cover the basics. The full check reads many more pages and asks ChatGPT about you.",
  fixN: (n: number) => `Fix ${n}`,
  points: (n: number) => `+${n} ${n === 1 ? "point" : "points"}`,
  pointsSr: "Could add about ",
  impact: { high: "Urgent", medium: "Important", low: "Nice to have" } as Record<IssueImpact, string>,
  effort: { quick: "Quick fix", moderate: "Some work", involved: "Bigger job" } as Record<IssueEffort, string>,
  affects: (n: number) => `Affects ${n} ${n === 1 ? "page" : "pages"}`,
  whatsWrong: "What's wrong",
  firstSteps: "First steps",
  stepSr: (n: number) => `Step ${n}: `,
  moreSteps: "The full check shows every step and the exact pages.",
  howToFix: "How to fix",

  /* ---- result: simple visual summary (Nov 2026: less text, more visual) ---- */
  nowLabel: "Now",
  afterLabel: "After fixes",
  goodMark: "Good",
  bandShort: {
    poor: "Google and AI struggle to understand your website.",
    ok: "A good start, with a few gaps to fix.",
    good: "Your basics are in good shape.",
  } as Record<ScoreBandKey, string>,
  afterFixes: (fixes: number, after: number) =>
    `Fix ${fixes === 1 ? "the item" : `the ${fixes} items`} below to reach about ${after}.`,
  /* ---- result: website at a glance, benchmark, ChatGPT preview, 30-day plan, sticky bar ---- */
  glanceTitle: "Your website at a glance",
  googleTitle: "How Google shows your homepage",
  googleNoTitle: "(No Google headline: Google makes one up)",
  googleNoDesc: "No Google summary, so Google picks random text from your page.",
  googleTitleLong: "Headline too long: Google cuts it off.",
  googleDescLong: "Summary too long: Google cuts it off.",
  googleOk: "Looks good on Google.",
  aiTitle: "Can AI assistants read your website?",
  aiAllowed: "Can read",
  aiBlocked: "Blocked",
  basicsTitle: "Website basics",
  factHttps: "Secure connection (https)",
  factSitemap: (n: number) => (n > 0 ? `Page list for Google (${n} pages)` : "Page list for Google (sitemap)"),
  factRobots: "Rules for robots (robots.txt)",
  factLlms: "Guide for AI (llms.txt)",
  factSchema: "Business info for Google and AI",
  factH1: "Main heading on homepage",
  factAlt: (withAlt: number, total: number) => `Image descriptions (${withAlt} of ${total})`,
  benchBetter: (pct: number) => `Better than ${pct}% of websites checked on MyWebRank`,
  benchAverage: (n: number) => `Average: ${n}`,
  benchYou: "You",
  chatTitle: "What does ChatGPT say about you?",
  chatAsk: (name: string) => `What do you know about ${name}? Would you recommend them?`,
  chatLocked: "We ask ChatGPT, Gemini and Perplexity in the full check.",
  chatCta: "See what AI says about you",
  planTitle: "Your 30-day plan",
  planIntro: "What to fix first, week by week.",
  planWeeks: ["Week 1", "Week 2", "Weeks 3–4"],
  planFixes: (n: number) => `${n} fix${n === 1 ? "" : "es"}`,
  planCta: "Start your plan free",
  stickyText: (n: number) => `${n} problem${n === 1 ? "" : "s"} found`,
  stickyCta: "Fix them free",
  stickyClose: "Hide",
  /* ---- result: scan summary, locked problems, everything we checked ---- */
  scanTitle: "What we found on your website",
  statPages: "pages read",
  statChecks: "checks run",
  statPassed: "passed",
  statProblems: "problems found",
  pagesReadTitle: "Pages we read",
  fullReadsAll: "The full check reads your whole website.",
  moreTitle: (n: number) => `${n} more problem${n === 1 ? "" : "s"} found`,
  moreIntro: "Here's what else we found on your website. How to fix each one is in the full report.",
  lockedFix: "Fix in full report",
  andMore: (n: number) => `+ ${n} more in the full report`,
  unlockFixes: "Unlock all fixes",
  checkedTitle: "Everything we checked",
  checkedIntro: "Tap an area to see each check.",
  passedOf: (pass: number, total: number) => `${pass} of ${total} passed`,
  moreChecks: (n: number) => `+ ${n} more check${n === 1 ? "" : "s"} in the full report`,
  workingTitle: "What's already working",
  unlockList: (n: number) => [
    n > 1 ? `All ${n} fixes, step by step` : "Every fix, step by step",
    "What ChatGPT says about you",
    "Your whole website checked every week",
  ],
  pointsNote:
    "Points are our estimate of how much your score here would rise after each fix. They are not a promise of a Google position or an AI mention.",

  /* ---- result: locked ChatGPT box ---- */
  lockedTitle: "What does ChatGPT say about you?",
  lockedBody: (days: number) => `See it free for ${days} days.`,
  lockedNote: "This free check reads your website. It does not ask ChatGPT — the full check does.",
  lockedCta: "See what ChatGPT says",

  /* ---- result: see all fixes ---- */
  seeAllTitle: (n: number, days: number) =>
    n > 1 ? `See all ${n} fixes free for ${days} days` : n === 1 ? `See the full fix free for ${days} days` : `See the full check free for ${days} days`,
  seeAllBody:
    "The full check reads your whole website, asks ChatGPT and Gemini the questions your customers ask, and gives you a step-by-step to-do list.",
  startTrial: "Start free trial",
  addToAccount: "Add to my account",
  addToAccountNote: "You're signed in. We'll add this website to your account and run the full check.",
  noPromise: "Nobody can promise a Google position or an AI mention. We measure honestly.",

  /* ---- result: email box ---- */
  moreFixes: (n: number) => `+${n} more fix${n === 1 ? "" : "es"}`,
  loginTitle: "See your full report",
  loginBody: "Log in and we'll open the full report for this website. No account yet? You can make one free on the next screen.",
  loginButton: "Log in to see the full report",
  orEmail: "Don't want to log in? Get it by email instead",
  emailLabel: "Email me my full result",
  emailPlaceholder: "you@yourbusiness.com",
  emailSaving: "Saving…",
  emailNote: "No spam. One email with your result, and you can say stop any time.",
  emailThanks: (email: string) => `Thanks — we'll email your full result to ${email}.`,
  emailThanksNext: "Want it now? Start the free trial above.",
  emailInvalid: "That email doesn't look right. Check it and try again, e.g. you@yourbusiness.com.",
  emailFailed: "We couldn't save your email. Try again, or start the free trial above to see every fix now.",
  emailNetwork: "We couldn't reach our server. Check your connection and try again.",
  emailServerError: serverMessage,
  lockedInFull: "Shown in the full check",

  /* ---- result: share ---- */
  shareTitle: "Share your score",
  shareBody: "Tell your team or a friend with a website. The link opens the free check for your site.",
  shareWhatsapp: "Share on WhatsApp",
  shareLinkedin: "Share on LinkedIn",
  /** The ready-typed message. `score` is null when the site could not be scored. */
  shareMessage: (host: string, score: number | null, brand: string, link: string) =>
    score === null
      ? `I checked ${host} on ${brand}'s free website check. Check your website free: ${link}`
      : `${host} scored ${score}/100 on ${brand}'s free website check (Found Score). Check your website free: ${link}`,

  /* ---- result: our team card ---- */
  teamTitle: "Too busy to fix this? Our team will do it for you.",
  teamBody: "Do it for me: our team changes it for you. Book a free call and we'll walk through your result.",
  bookCall: "Book a free call",
};

export type FreeCheckStrings = typeof EN;

const HI_BAND: Record<ScoreBandKey, string> = { good: "अच्छा", ok: "सुधार चाहिए", poor: "कमज़ोर" };

/** Hindi for the errors the check API returns (by error code). Unknown codes fall back to the generic line. */
const HI_SERVER_ERRORS: Record<string, string> = {
  invalid_url: "वेबसाइट का पता सही नहीं लगा। example.com जैसा पता डालकर फिर कोशिश करें।",
  validation_error: "वेबसाइट का पता सही नहीं लगा। example.com जैसा पता डालकर फिर कोशिश करें।",
  blocked_url: "यह पता कोई ऐसी सार्वजनिक वेबसाइट नहीं है जिसे हम चेक कर सकें। अपनी मुख्य वेबसाइट का पता डालें।",
  captcha_failed: "सुरक्षा जाँच पूरी नहीं हुई। कृपया फिर कोशिश करें।",
  rate_limited: "अभी के लिए फ्री चेक की सीमा पूरी हो गई है। कुछ देर बाद फिर कोशिश करें, या पूरी रिपोर्ट के लिए फ्री ट्रायल शुरू करें।",
  unreachable: "हम यह वेबसाइट खोल नहीं पाए। पता जाँचकर फिर कोशिश करें।",
  timeout: "आपका होमपेज खुलने में बहुत देर लगी। एक मिनट बाद फिर कोशिश करें।",
  not_html: "इस पते पर कोई वेब पेज नहीं खुलता। पता जाँचकर फिर कोशिश करें।",
};

const HI_EMAIL_ERRORS: Record<string, string> = {
  validation_error: "यह ईमेल सही नहीं लग रहा। जाँचकर फिर कोशिश करें, जैसे you@yourbusiness.com।",
  rate_limited: "इस कनेक्शन से बहुत बार कोशिश हुई है। कुछ देर बाद फिर कोशिश करें, या हर सुधार अभी देखने के लिए ऊपर फ्री ट्रायल शुरू करें।",
  check_not_found: "यह चेक अब नहीं मिल रहा। फ्री चेक दोबारा चलाएँ, फिर अपना ईमेल डालें।",
};

const HI: FreeCheckStrings = {
  sectionLabel: "फ्री चेक चलाएँ",
  fieldLabel: "आपकी वेबसाइट",
  fieldHint: "आपके होमपेज का पता, जैसे yourbusiness.com",
  footnote: "फ्री · साइन-अप नहीं · हम सिर्फ़ आपके सार्वजनिक पेज पढ़ते हैं।",
  run: "मेरी वेबसाइट फ्री में चेक करें",
  runAgain: "दोबारा चेक करें",
  checking: "चेक हो रहा है…",
  progressLabel: "फ्री चेक की प्रगति",
  duration: "आम तौर पर इसमें 10–25 सेकंड लगते हैं।",
  steps: {
    security: "छोटी-सी सुरक्षा जाँच",
    home: "आपका होमपेज पढ़ना",
    robots: "देखना कि AI रोबोट अंदर आ सकते हैं या नहीं",
    pages: "आपके मुख्य पेज पढ़ना",
    score: "आपके स्कोर निकालना",
  },
  securityWaiting: "एक छोटी-सी सुरक्षा जाँच, फिर आपका चेक अपने आप शुरू हो जाएगा।",
  securityTick: "ऊपर सुरक्षा वाले बॉक्स पर टिक करें, आपका चेक अपने आप शुरू हो जाएगा।",
  checkedFor: (host) => `${host} का नतीजा`,
  checkAnother: "दूसरी वेबसाइट चेक करें",
  errEmptyUrl: "अपनी वेबसाइट का पता डालें, जैसे yourbusiness.com।",
  errCaptcha: "बटन के ऊपर सुरक्षा जाँच पर टिक करें, फिर दोबारा कोशिश करें।",
  errGeneric: "हमारी तरफ़ से कुछ गड़बड़ हुई। एक मिनट बाद फिर कोशिश करें।",
  errNetwork: "हम अपने सर्वर तक नहीं पहुँच पाए। अपना इंटरनेट जाँचकर फिर कोशिश करें।",
  serverError: (code) => (code && HI_SERVER_ERRORS[code]) || "हमारी तरफ़ से कुछ गड़बड़ हुई। एक मिनट बाद फिर कोशिश करें।",

  limitTitle: "इस घंटे के आपके फ्री चेक पूरे हो गए",
  limitIntro: "7 दिन का फ्री ट्रायल शुरू करें: अपनी वेबसाइट जितनी बार चाहें चेक करें और हर सुधार देखें। बहुत आसान है:",
  limitSteps: [
    "नीचे \"मेरा फ्री ट्रायल शुरू करें\" पर टैप करें।",
    "Google या ईमेल से साइन अप करें। 1 मिनट लगता है, कार्ड की ज़रूरत नहीं।",
    "हम आपकी वेबसाइट चेक करते हैं। कुछ मिनट में पूरी रिपोर्ट और हर सुधार तैयार।",
  ],
  limitCta: "मेरा फ्री ट्रायल शुरू करें",
  limitLater: "या एक घंटे बाद दूसरा फ्री चेक चलाएँ।",

  failTitle: "हम अभी यह वेबसाइट नहीं पढ़ पाए",
  failBody: "अपनी रिपोर्ट WhatsApp पर पाएँ। हमारी टीम इसे हाथ से चेक करके आज ही आपको भेजेगी।",
  failTryAgain: "फिर कोशिश करें",

  waTitle: "आपकी पूरी रिपोर्ट तैयार है",
  waIntro: "हर सुधार, कदम-दर-कदम, WhatsApp पर पाएँ।",
  waLabel: "WhatsApp नंबर",
  waPlaceholder: "98765 43210",
  waButton: "मेरे WhatsApp पर भेजें",
  waSaving: "भेज रहे हैं…",
  waInvalid: "अपना 10 अंकों का WhatsApp नंबर डालें, जैसे 98765 43210।",
  waFailed: "अभी आपका नंबर सेव नहीं हो पाया। एक मिनट बाद फिर कोशिश करें।",
  waNetwork: "हम अपने सर्वर तक नहीं पहुँच पाए। अपना इंटरनेट जाँचकर फिर कोशिश करें।",
  waNote: "आपका नंबर सिर्फ़ यह रिपोर्ट भेजने के लिए है। कोई स्पैम नहीं।",
  waThanks: (num) => `हो गया! आपकी रिपोर्ट +91 ${num} पर भेजी जा रही है।`,
  waThanksFailed: (num) => `धन्यवाद! हमारी टीम आज ही +91 ${num} पर WhatsApp से आपकी रिपोर्ट भेजेगी।`,
  waThanksNext: "हर सुधार अभी देखना है? अपना फ्री ट्रायल शुरू करें।",

  overallName: "Found Score",
  overallLabel: "आपका Found Score",
  eyebrow: (host) => `आपका Found Score · ${host}`,
  bandLabel: HI_BAND,
  notChecked: "अभी चेक नहीं हुआ",
  basedOn: (pages) => `अभी पढ़े गए ${pages} पेज के आधार पर`,
  basedOnFor: " — ",

  fourScores: "आपके चार स्कोर",
  fourScoresCaption: "हर हिस्से का स्कोर 0 से 100 तक है। हरा अच्छा है, पीला मतलब सुधार चाहिए, लाल कमज़ोर है।",
  pillarName: {
    seo: "SEO · Google स्कोर",
    aeo: "AEO · जवाब स्कोर",
    geo: "GEO · AI स्कोर",
    brand: "Brand · भरोसा स्कोर",
  },
  pillarQuestion: {
    seo: "क्या Google आपके पेज ढूँढकर दिखा सकता है?",
    aeo: "क्या आपके पेज सवालों के इतने साफ़ जवाब देते हैं कि उन्हें कोट किया जा सके?",
    geo: "क्या ChatGPT जैसे AI असिस्टेंट आपको पढ़ और समझ सकते हैं?",
    brand: "क्या आपके बिज़नेस की जानकारी आसानी से मिलती है और भरोसा जगाती है?",
  },
  pillarSummary: (band, pass, total, fail) => `${HI_BAND[band]}: ${total} में से ${pass} जाँच पास।${fail ? ` ${fail} सबसे ज़रूरी ${fail === 1 ? "है" : "हैं"}।` : ""}`,
  websiteOnly: "सिर्फ़ आपकी वेबसाइट से। पूरा चेक ChatGPT से भी पूछता है।",
  fullCheckOnly: "पूरा चेक",
  notMeasuredAi: "पूरे चेक में दिखता है — साइन-अप के बाद हम ChatGPT, Gemini और दूसरों से आपके बारे में पूछते हैं।",
  notMeasured: "जो पेज हमने पढ़े, उनसे यह मापा नहीं जा सका।",
  meterLabel: (name) => `${name}`,

  meaning: "इसका क्या मतलब है",
  meaningCaption: "आपका स्कोर कहाँ है: 50 से कम कमज़ोर, 50 से 74 मतलब सुधार चाहिए, 75 और ऊपर अच्छा।",
  you: (n) => `आप: ${n}`,
  inRange: (n, band) => `आपका स्कोर ${n} है, यानी “${HI_BAND[band]}”।`,
  bandMeaning: {
    poor: "Google और AI असिस्टेंट को आपकी वेबसाइट समझने में मुश्किल होती है। नीचे दिए सुधार ऊपर जाने का सबसे तेज़ रास्ता हैं।",
    ok: "कुछ बुनियादी चीज़ें ठीक हैं, पर कुछ कमियों की वजह से Google और AI के लिए आपको चुनना मुश्किल होता है।",
    good: "आपके पेज बुनियादी चीज़ें अच्छी तरह पूरी करते हैं। पूरा चेक अगले सुधार ढूँढता है, और यह भी कि ChatGPT आपके बारे में क्या कहता है।",
  },
  couldAdd: (fixes, gain, after) =>
    `आपके ${fixes === 1 ? "सबसे ज़रूरी सुधार" : `टॉप ${fixes} सुधारों`} से करीब ${gain} पॉइंट बढ़ सकते हैं, यानी स्कोर लगभग ${after} तक।`,
  goodAway: (n) => `“अच्छा” 75 से शुरू होता है, जो ${n} पॉइंट दूर है।`,

  fixesTitle: (n) => (n ? (n === 1 ? "आपका सबसे ज़रूरी सुधार" : `आपके टॉप ${n} सुधार`) : "कोई बड़ी समस्या नहीं मिली"),
  fixesIntro: "सबसे ज़्यादा फ़ायदे वाला पहले। कैसे ठीक करें, देखने के लिए टैप करें।",
  noFixesIntro: "बहुत बढ़िया — जो पेज हमने पढ़े, उनमें बुनियादी चीज़ें ठीक हैं। पूरा चेक और बहुत सारे पेज पढ़ता है और ChatGPT से आपके बारे में पूछता है।",
  fixN: (n) => `सुधार ${n}`,
  points: (n) => `+${n} पॉइंट`,
  pointsSr: "करीब इतना बढ़ सकता है: ",
  impact: { high: "तुरंत ज़रूरी", medium: "ज़रूरी", low: "हो जाए तो अच्छा" },
  effort: { quick: "जल्दी होने वाला", moderate: "थोड़ी मेहनत", involved: "बड़ा काम" },
  affects: (n) => `${n} पेज पर असर`,
  whatsWrong: "क्या गड़बड़ है",
  firstSteps: "पहले कदम",
  stepSr: (n) => `कदम ${n}: `,
  moreSteps: "पूरे चेक में हर कदम और ठीक वही पेज दिखते हैं।",
  howToFix: "कैसे ठीक करें",

  nowLabel: "अभी",
  afterLabel: "सुधार के बाद",
  goodMark: "अच्छा",
  bandShort: {
    poor: "Google और AI को आपकी वेबसाइट समझने में मुश्किल होती है।",
    ok: "अच्छी शुरुआत है, बस कुछ कमियाँ ठीक करनी हैं।",
    good: "आपकी बुनियादी चीज़ें ठीक हैं।",
  },
  afterFixes: (fixes, after) => `नीचे के ${fixes} सुधार करें और लगभग ${after} तक पहुँचें।`,
  glanceTitle: "एक नज़र में आपकी वेबसाइट",
  googleTitle: "Google आपका होमपेज कैसे दिखाता है",
  googleNoTitle: "(Google हेडलाइन नहीं है: Google खुद बना लेता है)",
  googleNoDesc: "Google सारांश नहीं है, इसलिए Google आपके पेज से कोई भी टेक्स्ट उठा लेता है।",
  googleTitleLong: "हेडलाइन बहुत लंबी है: Google इसे काट देता है।",
  googleDescLong: "सारांश बहुत लंबा है: Google इसे काट देता है।",
  googleOk: "Google पर ठीक दिखता है।",
  aiTitle: "क्या AI असिस्टेंट आपकी वेबसाइट पढ़ सकते हैं?",
  aiAllowed: "पढ़ सकता है",
  aiBlocked: "रोका गया",
  basicsTitle: "वेबसाइट की बुनियादी बातें",
  factHttps: "सुरक्षित कनेक्शन (https)",
  factSitemap: (n) => (n > 0 ? `Google के लिए पेज लिस्ट (${n} पेज)` : "Google के लिए पेज लिस्ट (sitemap)"),
  factRobots: "रोबोट के नियम (robots.txt)",
  factLlms: "AI के लिए गाइड (llms.txt)",
  factSchema: "Google और AI के लिए बिज़नेस जानकारी",
  factH1: "होमपेज पर मुख्य हेडिंग",
  factAlt: (withAlt, total) => `तस्वीरों का विवरण (${total} में से ${withAlt})`,
  benchBetter: (pct) => `MyWebRank पर जाँची गई ${pct}% वेबसाइटों से बेहतर`,
  benchAverage: (n) => `औसत: ${n}`,
  benchYou: "आप",
  chatTitle: "ChatGPT आपके बारे में क्या कहता है?",
  chatAsk: (name) => `${name} के बारे में आप क्या जानते हैं? क्या आप इन्हें सुझाएँगे?`,
  chatLocked: "पूरे चेक में हम ChatGPT, Gemini और Perplexity से पूछते हैं।",
  chatCta: "देखें AI आपके बारे में क्या कहता है",
  planTitle: "आपका 30 दिन का प्लान",
  planIntro: "पहले क्या ठीक करें, हफ़्ते-दर-हफ़्ते।",
  planWeeks: ["हफ़्ता 1", "हफ़्ता 2", "हफ़्ते 3–4"],
  planFixes: (n) => `${n} सुधार`,
  planCta: "अपना प्लान फ्री में शुरू करें",
  stickyText: (n) => `${n} समस्याएँ मिलीं`,
  stickyCta: "फ्री में ठीक करें",
  stickyClose: "छिपाएँ",
  scanTitle: "आपकी वेबसाइट पर हमें क्या मिला",
  statPages: "पेज पढ़े",
  statChecks: "जाँचें",
  statPassed: "पास",
  statProblems: "समस्याएँ मिलीं",
  pagesReadTitle: "हमने ये पेज पढ़े",
  fullReadsAll: "पूरा चेक आपकी पूरी वेबसाइट पढ़ता है।",
  moreTitle: (n) => `${n} और समस्याएँ मिलीं`,
  moreIntro: "आपकी वेबसाइट पर हमें ये भी मिला। हर एक को ठीक करने का तरीका पूरी रिपोर्ट में है।",
  lockedFix: "तरीका पूरी रिपोर्ट में",
  andMore: (n) => `+ ${n} और, पूरी रिपोर्ट में`,
  unlockFixes: "सभी सुधार खोलें",
  checkedTitle: "हमने क्या-क्या जाँचा",
  checkedIntro: "हर हिस्से की जाँचें देखने के लिए टैप करें।",
  passedOf: (pass, total) => `${total} में से ${pass} पास`,
  moreChecks: (n) => `+ ${n} और जाँचें, पूरी रिपोर्ट में`,
  workingTitle: "जो पहले से ठीक है",
  unlockList: (n) => [
    n > 1 ? `सभी ${n} सुधार, कदम-दर-कदम` : "हर सुधार, कदम-दर-कदम",
    "ChatGPT आपके बारे में क्या कहता है",
    "हर हफ़्ते पूरी वेबसाइट का चेक",
  ],
  pointsNote: "पॉइंट हमारा अंदाज़ा हैं कि हर सुधार के बाद आपका यहाँ का स्कोर कितना बढ़ेगा। यह Google पर किसी जगह या AI में नाम आने का वादा नहीं है।",

  lockedTitle: "ChatGPT आपके बारे में क्या कहता है?",
  lockedBody: (days) => `${days} दिन फ्री में देखें।`,
  lockedNote: "यह फ्री चेक सिर्फ़ आपकी वेबसाइट पढ़ता है। यह ChatGPT से नहीं पूछता — वह पूरा चेक करता है।",
  lockedCta: "देखें ChatGPT क्या कहता है",

  seeAllTitle: (n, days) =>
    n > 1 ? `सभी ${n} सुधार ${days} दिन फ्री में देखें` : n === 1 ? `पूरा सुधार ${days} दिन फ्री में देखें` : `पूरा चेक ${days} दिन फ्री में देखें`,
  seeAllBody: "पूरा चेक आपकी पूरी वेबसाइट पढ़ता है, ChatGPT और Gemini से वही सवाल पूछता है जो आपके ग्राहक पूछते हैं, और आपको कदम-दर-कदम काम की लिस्ट देता है।",
  startTrial: "फ्री ट्रायल शुरू करें",
  addToAccount: "मेरे अकाउंट में जोड़ें",
  addToAccountNote: "आप साइन-इन हैं। हम यह वेबसाइट आपके अकाउंट में जोड़कर पूरा चेक चलाएँगे।",
  noPromise: "Google पर कोई जगह या AI में नाम आने का वादा कोई नहीं कर सकता। हम ईमानदारी से मापते हैं।",

  moreFixes: (n) => `+${n} और सुधार`,
  loginTitle: "अपनी पूरी रिपोर्ट देखें",
  loginBody: "लॉग इन करें, हम इस वेबसाइट की पूरी रिपोर्ट खोल देंगे। अकाउंट नहीं है? अगली स्क्रीन पर मुफ़्त बना सकते हैं।",
  loginButton: "पूरी रिपोर्ट देखने के लिए लॉग इन करें",
  orEmail: "लॉग इन नहीं करना? ईमेल से पाएँ",
  emailLabel: "मेरा पूरा नतीजा ईमेल करें",
  emailPlaceholder: "you@yourbusiness.com",
  emailSaving: "सेव हो रहा है…",
  emailNote: "कोई स्पैम नहीं। आपके नतीजे वाला एक ईमेल, और आप जब चाहें मना कर सकते हैं।",
  emailThanks: (email) => `धन्यवाद — हम आपका पूरा नतीजा ${email} पर भेजेंगे।`,
  emailThanksNext: "अभी देखना है? ऊपर फ्री ट्रायल शुरू करें।",
  emailInvalid: "यह ईमेल सही नहीं लग रहा। जाँचकर फिर कोशिश करें, जैसे you@yourbusiness.com।",
  emailFailed: "हम आपका ईमेल सेव नहीं कर पाए। फिर कोशिश करें, या हर सुधार अभी देखने के लिए ऊपर फ्री ट्रायल शुरू करें।",
  emailNetwork: "हम अपने सर्वर तक नहीं पहुँच पाए। अपना इंटरनेट जाँचकर फिर कोशिश करें।",
  emailServerError: (code) => (code && HI_EMAIL_ERRORS[code]) || null,
  lockedInFull: "पूरे चेक में दिखता है",

  shareTitle: "अपना स्कोर शेयर करें",
  shareBody: "अपनी टीम या किसी दोस्त को बताएँ जिसकी वेबसाइट है। लिंक से आपकी साइट का फ्री चेक खुलता है।",
  shareWhatsapp: "WhatsApp पर शेयर करें",
  shareLinkedin: "LinkedIn पर शेयर करें",
  shareMessage: (host, score, brand, link) =>
    score === null
      ? `मैंने ${host} को ${brand} के फ्री वेबसाइट चेक पर चेक किया। अपनी वेबसाइट फ्री में चेक करें: ${link}`
      : `${host} को ${brand} के फ्री वेबसाइट चेक में ${score}/100 मिले (Found Score)। अपनी वेबसाइट फ्री में चेक करें: ${link}`,

  teamTitle: "इसे ठीक करने का समय नहीं है? हमारी टीम आपके लिए कर देगी।",
  teamBody: "आप कर दीजिए (Do it for me): हमारी टीम आपकी वेबसाइट में बदलाव कर देती है। फ्री कॉल बुक करें, हम आपका नतीजा साथ बैठकर समझाएँगे।",
  bookCall: "फ्री कॉल बुक करें",
};

const STRINGS: Record<FreeCheckLang, FreeCheckStrings> = { en: EN, hi: HI };

export function freeCheckStrings(lang: FreeCheckLang = "en"): FreeCheckStrings {
  return STRINGS[lang] ?? EN;
}
