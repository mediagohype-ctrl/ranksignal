import type { Article } from "@/lib/learn/articles";

export const article: Article = {
  slug: "how-to-measure-geo",
  title: "How to measure generative engine optimization (GEO): metrics, method and a simple tracker",
  metaTitle: "How to Measure Generative Engine Optimization",
  description:
    "How to measure generative engine optimization: the 5 GEO metrics that matter, how to sample questions, how often to check, and a simple tracking sheet.",
  keywords: [
    "how to measure generative engine optimization",
    "how to measure GEO",
    "GEO metrics",
    "AI visibility metrics",
    "track AI mentions",
    "share of AI answers",
  ],
  published: "2026-11-24",
  updated: "2026-11-24",
  answer:
    "To measure generative engine optimization, ask AI assistants a fixed set of real customer questions on a schedule and record five things: how often you are named, your share of answers against competitors, whether your site is linked, whether the facts are correct, and your position in lists. Track rates over weeks, not single answers.",
  keyPoints: [
    "GEO is measured in rates across many answers, not by one screenshot: AI answers change from one try to the next.",
    "The five core metrics are mention rate, share of answers, citations (links to your site), accuracy and list position.",
    "Use 20–50 questions your customers really ask, split by topic and city, and keep the list fixed so weeks compare fairly.",
    "Check at least every two weeks, ideally weekly, across ChatGPT, Gemini and Perplexity.",
    "A spreadsheet works to start; MyWebRank automates the same method every week.",
  ],
  sections: [
    {
      id: "what-is-measured",
      heading: "What does “measuring GEO” actually mean?",
      paragraphs: [
        "Generative engine optimization (GEO) is the work of getting your business named, described correctly and linked inside answers written by AI assistants such as ChatGPT, Gemini, Perplexity and Google AI Overviews. If that is new to you, start with [what GEO is](/learn/what-is-geo).",
        "There is no “GEO rank” like a Google position. An AI assistant writes a fresh answer every time, so the same question can name you on Monday and leave you out on Tuesday. Measuring GEO therefore means sampling: asking the same questions many times, across several assistants, and counting how often good things happen. The output is a set of percentages you can compare week to week.",
        "Do not confuse this with checking whether AI can read your site. That is AI readiness, and it is measured differently. The two are explained side by side in [AI readiness vs AI visibility](/learn/ai-readiness-vs-ai-visibility).",
      ],
    },
    {
      id: "five-metrics",
      heading: "Which GEO metrics should you track?",
      paragraphs: [
        "Five numbers cover almost everything a small business needs. Each one is a simple count divided by the number of answers you checked.",
      ],
      table: {
        head: ["Metric", "What it tells you", "How to calculate it"],
        rows: [
          ["Mention rate", "How often AI names your business at all", "Answers that name you ÷ total answers checked"],
          ["Share of answers", "How often you are named compared with competitors", "Your mentions ÷ mentions of you plus your main competitors"],
          ["Citation rate", "How often the answer links to your own website", "Answers that link to your site ÷ total answers checked"],
          ["Accuracy", "Whether AI gets your facts right: services, prices, address, hours", "Answers with correct facts ÷ answers that name you"],
          ["List position", "Where you appear when AI gives a list of options", "Average position in list-style answers (1 = first)"],
        ],
      },
    },
    {
      id: "metric-detail",
      heading: "Why do these five matter more than anything else?",
      paragraphs: [
        "Mention rate is the headline: if a Pune bakery is named in 6 of 30 answers to “best custom cake shop in Pune”, its mention rate is 20%. On its own, though, it can mislead, because some questions name ten businesses and some name two.",
        "Share of answers fixes that by putting you next to the competitors that matter. If the same bakery gets 6 mentions and its three main rivals get 12, 9 and 3, its share is 6 of 30, or 20% of all mentions among that group. Watching share shows whether you are gaining ground or just riding a general rise.",
        "Citation rate matters because a linked mention can send a visitor; an unlinked one only builds awareness. Perplexity and ChatGPT search usually show sources, so you can see whether your own page or a directory listing was linked.",
        "Accuracy is easy to skip and costly to ignore. Being named with the wrong phone number or an old price does more harm than not being named. Note every wrong fact, then fix it where AI is probably reading it: your own site, your Google Business Profile, and the directories that list you.",
        "List position counts because many AI answers are short lists. Being fifth of five is weaker than being first.",
      ],
    },
    {
      id: "pick-questions",
      heading: "How do you choose which questions to ask AI?",
      paragraphs: [
        "Your measurement is only as good as your question list. Use the questions real customers ask, in the words they use, not the phrases you wish they used.",
      ],
      steps: [
        "Collect questions from sales calls, WhatsApp and email enquiries, Google’s “People also ask” box and your Search Console queries.",
        "Write 20–50 questions across three types: discovery (“best physiotherapy clinic in Koramangala”), comparison (“X vs Y for small business accounting”) and fact questions about you (“does [your business] deliver on Sundays?”).",
        "Add the city or area wherever customers would: most local buyers do, and answers differ a lot by location.",
        "Avoid questions that include your own name in discovery questions; you want to know if AI suggests you unprompted.",
        "Freeze the list. Change it only once a quarter, and note the date, so week-to-week numbers stay comparable.",
      ],
    },
    {
      id: "how-often",
      heading: "How many answers and how often should you check?",
      paragraphs: [
        "Because answers vary, one run of each question is not enough to trust a small change. A practical rule for a small business: ask every question at least once per assistant per check, and judge trends over four or more checks rather than reacting to one week.",
        "Check weekly if you can, every two weeks at minimum. Weekly checks show the effect of a fix within a month or two; monthly checks are too slow to tell which change helped. Always ask in a new chat, logged out or in a private window where possible, so past conversations do not tilt the answer.",
        "Report every number with its sample size, for example “named in 14 of 90 answers (16%)”. A jump from 1 of 5 to 2 of 5 sounds like doubling but is mostly noise.",
      ],
    },
    {
      id: "tracking-sheet",
      heading: "How do you set up a simple GEO tracking spreadsheet?",
      paragraphs: [
        "A Google Sheet or Excel file is enough to start. Use one row per answer, so you can filter and count later.",
      ],
      table: {
        head: ["Column", "Example entry"],
        rows: [
          ["Date", "24 Nov 2026"],
          ["AI assistant", "ChatGPT"],
          ["Question", "Best custom cake shop in Pune for a birthday"],
          ["Named? (Y/N)", "Y"],
          ["Position in list", "3 of 5"],
          ["Linked to our site? (Y/N)", "N (linked a directory page)"],
          ["Competitors named", "Bakery A, Bakery B, Bakery C"],
          ["Facts correct? (Y/N + note)", "N: old phone number"],
          ["Sources shown", "Directory listing, a food blog"],
        ],
      },
      bullets: [
        "Add a summary tab that counts mention rate, share of answers, citation rate and accuracy per week.",
        "Chart each metric by week so trends are visible at a glance.",
        "Keep a separate “changes made” log with dates, so you can match a rise or fall to a fix.",
        "Copy the “Sources shown” column into a list of sites to get listed on: these are the pages AI trusts for your category.",
      ],
    },
    {
      id: "what-moves-numbers",
      heading: "What should you do when the numbers are low?",
      paragraphs: [
        "Low numbers usually point to one of three gaps. First, AI cannot read your site well: robots rules blocking AI crawlers, content hidden behind JavaScript, or no clear statement of what you do and where. Our [AI crawler checker](/tools/ai-crawler-checker) tests the access part in seconds.",
        "Second, you are missing from the third-party pages AI quotes: lists, directories and reviews. Your “Sources shown” column tells you exactly which ones. Third, your facts are inconsistent across the web, so AI is unsure how to describe you. The fixes for all three are covered in [how to get mentioned by ChatGPT](/learn/how-to-get-mentioned-by-chatgpt).",
      ],
    },
    {
      id: "automate",
      heading: "How does MyWebRank automate GEO measurement?",
      paragraphs: [
        "Doing this by hand for 30 questions across three assistants every week is 90 answers to read and log. To get a quick first reading, the free [AI visibility checker](/tools/ai-visibility-checker) asks ChatGPT, Gemini and Perplexity a customer-style question for your category and city, and shows whether each one names you and who it names instead.",
        "For ongoing tracking, the Do it myself plan (₹1,999/month + GST, 7-day free trial, no card) asks ChatGPT, Gemini and Perplexity your customers’ questions every week and reports how often you are named, linked and described, alongside competitors, with a to-do list of fixes. See [AI visibility tracking](/features/ai-visibility-tracking) for what the report shows. If you want to fix the site side first, the [free website check](/free-check) scores your SEO, AEO, GEO and Brand in about 30 seconds.",
        "No tool can promise that AI will mention you. What good measurement gives you is an honest rate, a clear list of gaps, and proof of whether each fix helped.",
      ],
    },
  ],
  faqs: [
    {
      q: "What is the most important GEO metric?",
      a: "Share of answers is the most useful single number, because it shows how often you are named compared with your real competitors. Mention rate alone can rise or fall simply because AI lists more or fewer businesses.",
    },
    {
      q: "Can Google Analytics measure GEO?",
      a: "Only partly. Analytics can show visits referred from chatgpt.com, perplexity.ai and similar sites, but it cannot show answers where you were named without a click. You still need to sample the answers themselves.",
    },
    {
      q: "How many questions do I need to measure GEO?",
      a: "For a small business, 20–50 real customer questions is a good range. Fewer than about 20 makes the numbers jumpy; more than 50 is hard to review by hand, which is where automated tracking helps.",
    },
    {
      q: "Why did my AI mention rate drop when I changed nothing?",
      a: "AI answers vary between runs, assistants update their models, and competitors change their sites. Look at the trend over four or more checks before acting, and check whether the sources AI cites have changed.",
    },
    {
      q: "Is there a free way to measure GEO?",
      a: "Yes. Track answers by hand in a spreadsheet using the method on this page, and use the free MyWebRank AI visibility checker for a quick reading across ChatGPT, Gemini and Perplexity.",
    },
  ],
  related: ["what-is-geo", "ai-readiness-vs-ai-visibility", "track-brand-mentions-in-chatgpt"],
  cta: { label: "Check if AI names you free", href: "/tools/ai-visibility-checker" },
  sources: [
    { label: "Aggarwal et al. (2023): GEO: Generative Engine Optimization (arXiv)", url: "https://arxiv.org/abs/2311.09735" },
    { label: "Google Search Central: AI features and your website", url: "https://developers.google.com/search/docs/appearance/ai-features" },
    { label: "OpenAI: overview of OpenAI crawlers", url: "https://platform.openai.com/docs/bots" },
  ],
};
