import type { Article } from "@/lib/learn/articles";

export const article: Article = {
  slug: "ai-readiness-vs-ai-visibility",
  title: "AI readiness vs AI visibility: what’s the difference, and which should you check first?",
  metaTitle: "AI Readiness vs AI Visibility: What's the Difference?",
  description:
    "AI readiness is whether AI can read your site. AI visibility is whether AI actually recommends you. Learn the difference and how to improve both.",
  keywords: [
    "AI readiness vs AI visibility",
    "AI readiness check",
    "AI visibility",
    "is my website AI ready",
    "AI search readiness",
    "AI visibility checker",
  ],
  published: "2026-11-24",
  updated: "2026-11-24",
  answer:
    "AI readiness is whether AI assistants can reach, read and understand your website: crawler access, content in plain HTML, structured data, clear facts and an llms.txt file. AI visibility is whether ChatGPT, Gemini or Perplexity actually name and link your business in their answers. Readiness is the cause you control; visibility is the result you measure.",
  keyPoints: [
    "Readiness is about your website; visibility is about AI answers.",
    "Readiness can be checked in one pass of your site; visibility needs many AI answers sampled over weeks.",
    "A site can be fully ready and still invisible if other sites AI trusts never mention it.",
    "Fix readiness first, because a site AI cannot read is unlikely to be named.",
    "MyWebRank’s free website check measures readiness; the AI visibility checker and paid plans measure visibility.",
  ],
  sections: [
    {
      id: "readiness",
      heading: "What is AI readiness?",
      paragraphs: [
        "AI readiness describes your own website from an AI assistant’s point of view. Can its robots get in? Can they read the text without running JavaScript? Is it obvious what the business is, what it sells, where it works and how to contact it? Is that information marked up so machines can tell a price from an address?",
        "Readiness is fully in your hands. It is a property of your pages and settings, so it can be checked in one go and stays the same until you change something. Think of it as making sure the shop is open, lit and has a clear sign above the door.",
      ],
      bullets: [
        "Crawler access: your site’s robot rules file (robots.txt) and firewall let in AI crawlers such as GPTBot, OAI-SearchBot, PerplexityBot and ClaudeBot.",
        "Readable content: the main text is in the page’s HTML, not only drawn in later by JavaScript.",
        "Structured data (info for Google and AI): Organization or LocalBusiness and FAQPage markup that labels your facts.",
        "Clear facts: name, services, prices, areas served, address and phone stated plainly and the same everywhere.",
        "An llms.txt file (an AI guide file) that summarises who you are and links your key pages.",
      ],
    },
    {
      id: "visibility",
      heading: "What is AI visibility?",
      paragraphs: [
        "AI visibility describes the answers, not the website. When a customer asks ChatGPT “which interior designer in Hyderabad does small 2BHK flats?”, are you named? Is your website linked? Are the facts right? Who is named instead?",
        "Visibility depends on far more than your own site. AI assistants that search the web read a handful of pages for each question, and for most buying questions many of those pages belong to other people: directories, review sites, “best of” lists, news and forums. That is why visibility moves slowly, varies between runs, and has to be measured as a rate over many questions. The method is in [how to measure GEO](/learn/how-to-measure-geo).",
      ],
    },
    {
      id: "comparison",
      heading: "AI readiness vs AI visibility side by side",
      paragraphs: ["The simplest way to keep them apart: readiness is an input, visibility is an output."],
      table: {
        head: ["", "AI readiness", "AI visibility"],
        rows: [
          ["Question it answers", "Can AI read and understand my website?", "Do AI answers actually name and link my business?"],
          ["What is checked", "Your own pages, robot rules, structured data, facts, llms.txt", "Answers from ChatGPT, Gemini, Perplexity and other assistants"],
          ["Who controls it", "You, almost entirely", "Partly you; partly other websites and the AI itself"],
          ["How stable it is", "Stays the same until you change your site", "Changes between runs, weeks and model updates"],
          ["How you measure it", "One check of your site gives a clear pass or fail per item", "Many customer questions, asked repeatedly, reported as rates"],
          ["Typical fixes", "Unblock crawlers, add structured data, state facts plainly, add llms.txt", "Earn mentions on sites AI cites, fix wrong facts at the source, answer buyer questions"],
          ["MyWebRank tool", "Free website check", "Free AI visibility checker; weekly tracking on paid plans"],
        ],
      },
    },
    {
      id: "why-both",
      heading: "Can a website be AI ready but not visible?",
      paragraphs: [
        "Yes, and it is common. Picture a well-built website for a dental clinic in Jaipur: AI crawlers allowed, clean HTML, LocalBusiness markup, prices on the page. It is fully ready. But if ChatGPT answers “best dental clinic in Jaipur” by reading three local listing sites and a review roundup, and the clinic is on none of them, it will not be named.",
        "The opposite also happens. A well-known brand with a slow, script-heavy site may still be named because so many other sites talk about it. Its readiness gaps show up instead as wrong or out-of-date facts in answers, because AI cannot check the details on its own pages.",
        "So readiness is necessary but not sufficient. It removes the reasons AI would skip you; visibility work gives AI reasons to pick you.",
      ],
    },
    {
      id: "check-readiness",
      heading: "How do you check AI readiness?",
      paragraphs: [
        "You can check most of it yourself in about fifteen minutes, or let a tool do it.",
      ],
      steps: [
        "Open yoursite.com/robots.txt and confirm AI crawlers are not blocked, or run the free [AI crawler checker](/tools/ai-crawler-checker). Also ask whoever runs your hosting or CDN whether AI bots are blocked there.",
        "View the page source (Ctrl+U in most browsers) and confirm your main text is in it.",
        "Test your structured data with the free [schema checker](/tools/schema-checker).",
        "Read your home page as a stranger: does the first screen say what you do, for whom and where?",
        "Create an llms.txt file with the free [llms.txt generator](/tools/llms-txt-generator); the [llms.txt guide](/learn/llms-txt-guide) explains what it can and cannot do.",
      ],
    },
    {
      id: "check-visibility",
      heading: "How do you check AI visibility?",
      paragraphs: [
        "Visibility can only be checked by asking the AI assistants. Ask the questions your customers ask, in a new chat each time, and note whether you are named, linked and described correctly, and who is named instead. A step-by-step manual method is in [how to track brand mentions in ChatGPT](/learn/track-brand-mentions-in-chatgpt).",
        "For a quick first reading, the free [AI visibility checker](/tools/ai-visibility-checker) asks ChatGPT, Gemini and Perplexity a customer-style question for your category and city, and shows whether each names you and which businesses it names instead. One reading is a snapshot; trends need repeated checks.",
      ],
    },
    {
      id: "mywebrank",
      heading: "Which one does MyWebRank measure?",
      paragraphs: [
        "Both, with different tools. The [free website check](/free-check) measures readiness: it reads your home page and up to four main pages and scores SEO, AEO, GEO and Brand from 0 to 100, with the top fixes in plain words. It does not ask any AI assistant, so its GEO score tells you how ready you are, not how often you are named.",
        "The free AI visibility checker gives a one-off visibility reading. The Do it myself plan (₹1,999/month + GST, 7-day free trial, no card) does both every week: a website check of up to 250 pages for readiness, and your customers’ questions asked to ChatGPT, Gemini and Perplexity for visibility, with a to-do list and ready-to-paste fixes. See [AI visibility tracking](/features/ai-visibility-tracking) for details. Nobody can promise AI mentions; what you get is an honest measurement and a clear list of what to change.",
      ],
    },
  ],
  faqs: [
    {
      q: "Which should I fix first, AI readiness or AI visibility?",
      a: "Readiness. It is quicker, fully in your control, and a site AI cannot read is unlikely to be named or described correctly. Once the basics pass, spend your time on visibility work such as getting listed on the sites AI cites.",
    },
    {
      q: "Does a high AI readiness score mean ChatGPT will recommend me?",
      a: "No. Readiness removes barriers but does not guarantee mentions. AI assistants also rely on what other websites say about you, so a ready site can still be left out of answers.",
    },
    {
      q: "Is llms.txt needed for AI readiness?",
      a: "It is a small, cheap extra rather than a requirement. Crawler access, readable HTML, structured data and clear, consistent facts matter more. Not every AI system reads llms.txt yet.",
    },
    {
      q: "How often should I check AI visibility?",
      a: "Weekly or every two weeks. AI answers vary between runs, so judge the trend over several checks rather than reacting to a single answer.",
    },
    {
      q: "Is AI visibility the same as GEO?",
      a: "Closely related. GEO (generative engine optimization) is the work you do; AI visibility is the result you measure. Good GEO covers both readiness and visibility.",
    },
  ],
  related: ["how-to-measure-geo", "track-brand-mentions-in-chatgpt", "what-is-geo"],
  cta: { label: "Check your AI readiness free", href: "/free-check" },
  sources: [
    { label: "Google Search Central: AI features and your website", url: "https://developers.google.com/search/docs/appearance/ai-features" },
    { label: "OpenAI: overview of OpenAI crawlers", url: "https://platform.openai.com/docs/bots" },
    { label: "Google Search Central: introduction to structured data", url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
    { label: "IETF RFC 9309: Robots Exclusion Protocol", url: "https://datatracker.ietf.org/doc/html/rfc9309" },
    { label: "The llms.txt proposal (llmstxt.org)", url: "https://llmstxt.org/" },
  ],
};
