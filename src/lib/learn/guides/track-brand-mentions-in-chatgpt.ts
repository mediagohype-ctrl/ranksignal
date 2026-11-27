import type { Article } from "@/lib/learn/articles";

export const article: Article = {
  slug: "track-brand-mentions-in-chatgpt",
  title: "How to track brand mentions in ChatGPT (and check if it mentions your business)",
  metaTitle: "How to Track Brand Mentions in ChatGPT (Free Method)",
  description:
    "How to check if ChatGPT mentions your business and track brand mentions over time. Manual method, prompts to test, and free tools.",
  keywords: [
    "how to track brand mentions in ChatGPT",
    "how to check if ChatGPT mentions my business",
    "ChatGPT brand mentions",
    "track AI mentions",
    "does ChatGPT recommend my business",
    "brand monitoring in AI",
  ],
  published: "2026-11-24",
  updated: "2026-11-24",
  answer:
    "To track brand mentions in ChatGPT, list the questions your customers ask, ask each one in a new chat (logged out or in a private window), and record whether your business is named, linked and described correctly, and who is named instead. Repeat every week, because answers vary. A free AI visibility checker does a first reading in seconds.",
  keyPoints: [
    "ChatGPT has no dashboard that tells businesses when they are mentioned; you have to ask it and record the answers.",
    "Ask the questions customers ask, without your brand name, to see if ChatGPT suggests you unprompted.",
    "Answers change between runs, chats and accounts, so track rates over many questions and weeks.",
    "Check Gemini and Perplexity too: customers use more than one assistant.",
    "The free MyWebRank AI visibility checker asks ChatGPT, Gemini and Perplexity at once and shows who is named instead of you.",
  ],
  sections: [
    {
      id: "quick-check",
      heading: "How do I check if ChatGPT mentions my business right now?",
      paragraphs: [
        "The fastest way is the free [AI visibility checker](/tools/ai-visibility-checker). Enter your business name and your category and city, for example “Sharma Opticians, opticians in Lucknow”. It asks ChatGPT, Gemini and Perplexity a question a real customer would ask, then shows whether each assistant names your business and which businesses it names instead.",
        "That gives you a snapshot in under a minute, with no sign-up. It is the right first step, but one answer is not a trend. To know where you really stand, you need to ask more questions, more than once, and keep a record. The rest of this guide shows how.",
      ],
    },
    {
      id: "manual-method",
      heading: "How do you track ChatGPT brand mentions by hand?",
      paragraphs: [
        "You can do this yourself with ChatGPT and a spreadsheet. Set aside about an hour the first time and 30 minutes a week after that.",
      ],
      steps: [
        "Write 15–30 questions your customers actually ask. Take them from enquiries, WhatsApp chats and sales calls: “best CA firm for GST filing in Indore”, “which coaching centre in Kota has small batches for NEET”, “affordable wedding photographer in Kochi”.",
        "Leave your brand name out of these discovery questions. You want to know whether ChatGPT suggests you, not whether it has heard of you.",
        "Add a few fact questions with your name in them, such as “What does [your business] charge for X?” or “Where is [your business] located?”, to check accuracy.",
        "Open a new chat for every question. Use a private (incognito) window, logged out if possible, or turn off memory, so earlier conversations do not affect the answer.",
        "Record each answer in a sheet: date, question, named (yes/no), position if it is a list, linked to your site (yes/no), facts correct (yes/no), and which competitors were named.",
        "Note the sources ChatGPT shows when it searches the web. These are the pages it trusts for your category.",
        "Repeat weekly with the same questions, and work out the percentage of answers that name you.",
      ],
    },
    {
      id: "why-vary",
      heading: "Why does ChatGPT give different answers each time?",
      paragraphs: [
        "If you ask the same question twice you may get two different lists. That is normal, not a fault in your tracking. ChatGPT writes each answer fresh and includes a degree of randomness, so word choice and the businesses it names can shift between runs.",
      ],
      bullets: [
        "Web search or not: for some questions ChatGPT searches the web and cites sources; for others it answers from what it already learned. The two can name different businesses.",
        "Memory and past chats: a logged-in account with memory on can lean towards things you discussed before.",
        "Location and wording: “dentist near me” and “best dentist in Andheri West” are different questions to an AI.",
        "Model updates: OpenAI updates its models, and the sources available on the web change week to week.",
      ],
    },
    {
      id: "what-to-record",
      heading: "What should you record for each answer?",
      paragraphs: [
        "Recording the same fields every time turns a pile of screenshots into numbers you can act on.",
      ],
      table: {
        head: ["Field", "Why it matters"],
        rows: [
          ["Named? (yes/no)", "Gives your mention rate: answers naming you ÷ answers checked"],
          ["Position in list", "First of five is worth far more than fifth of five"],
          ["Linked to your site?", "A linked mention can send a visitor; a plain mention only builds awareness"],
          ["Facts correct?", "Wrong phone numbers, prices or areas cost you customers"],
          ["Competitors named", "Shows who wins the answer when you do not, and your share against them"],
          ["Sources shown", "Tells you which sites to get listed on or correct"],
        ],
      },
    },
    {
      id: "beyond-chatgpt",
      heading: "Should you track Gemini and Perplexity too?",
      paragraphs: [
        "Yes. Your customers do not all use ChatGPT. Gemini sits inside Google’s apps and Android phones, and Google AI Overviews draw on the same Google index. Perplexity always shows its sources, which makes it a useful guide to which pages AI trusts. A business can be named often by one assistant and never by another, because each one reads different sources.",
        "Running the manual method across three assistants triples the work, which is where tools help. The method and metrics for all of them are in [how to measure GEO](/learn/how-to-measure-geo).",
      ],
    },
    {
      id: "automate",
      heading: "How do you track ChatGPT mentions automatically?",
      paragraphs: [
        "Once you know the manual method works, automate it so it happens every week without fail. MyWebRank’s Do it myself plan (₹1,999/month + GST, 7-day free trial, no card) asks ChatGPT, Gemini and Perplexity your customers’ questions every week and shows how often you are named and linked, who is named instead, and the sources behind the answers. It also checks your website every week (up to 250 pages) and turns gaps into a to-do list with ready-to-paste fixes, plus a monthly report. See [AI visibility tracking](/features/ai-visibility-tracking).",
        "If you would rather hand the work over, the [Do it for me](/done-for-you) service (₹19,999/month + GST) has our team make the fixes and tracks up to five AI tools: ChatGPT, Gemini, Perplexity, Claude and Grok.",
      ],
    },
    {
      id: "if-not-mentioned",
      heading: "What if ChatGPT does not mention your business?",
      paragraphs: [
        "Start with the website. Run the [free website check](/free-check) to see whether AI crawlers can read your pages and whether your business facts are clear; the difference between this and being named is explained in [AI readiness vs AI visibility](/learn/ai-readiness-vs-ai-visibility).",
        "Then work on the sources. Look at the sites ChatGPT cited in your tracking sheet and get listed or reviewed on them, make your name, address and services identical everywhere, and publish pages that answer buyer questions directly. The full playbook is in [how to get mentioned by ChatGPT](/learn/how-to-get-mentioned-by-chatgpt). No one can guarantee a mention, so keep tracking and judge results over weeks, not days.",
      ],
    },
  ],
  faqs: [
    {
      q: "Can I see how many times ChatGPT has mentioned my brand?",
      a: "No. OpenAI does not offer businesses a report of mentions. The only way to know is to ask ChatGPT relevant questions yourself, or with a tracking tool, and count how often you are named.",
    },
    {
      q: "Is there a free way to check if ChatGPT mentions my business?",
      a: "Yes. The free MyWebRank AI visibility checker asks ChatGPT, Gemini and Perplexity a customer-style question for your category and city and shows whether each names you. You can also ask ChatGPT yourself in a new private chat.",
    },
    {
      q: "Why does ChatGPT mention my competitor but not me?",
      a: "Usually because your competitor appears on more of the pages ChatGPT reads for that question, such as directories, review sites and “best of” lists, or states its facts more clearly. Check which sources the answer cites.",
    },
    {
      q: "How often should I check ChatGPT for brand mentions?",
      a: "Weekly is ideal, every two weeks at minimum. Answers vary between runs, so look at the trend over a month or more rather than a single result.",
    },
    {
      q: "Does Google Analytics show traffic from ChatGPT?",
      a: "It can show visits where someone clicked a link from chatgpt.com, but not answers where you were named without a click. Use both: analytics for visits, answer tracking for mentions.",
    },
  ],
  related: ["how-to-get-mentioned-by-chatgpt", "how-to-measure-geo", "ai-readiness-vs-ai-visibility"],
  cta: { label: "Check if ChatGPT names you free", href: "/tools/ai-visibility-checker" },
  sources: [
    { label: "OpenAI: overview of OpenAI crawlers", url: "https://platform.openai.com/docs/bots" },
    { label: "Aggarwal et al. (2023): GEO: Generative Engine Optimization (arXiv)", url: "https://arxiv.org/abs/2311.09735" },
    { label: "Google Search Central: AI features and your website", url: "https://developers.google.com/search/docs/appearance/ai-features" },
  ],
};
