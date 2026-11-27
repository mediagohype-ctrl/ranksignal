// Learn hub: long-form guides that target the informational searches our buyers make
// ("what is AEO", "SEO vs GEO", "how to rank in ChatGPT", "SEO audit checklist", "how to choose an SEO company").
// Structure is deliberately answer-first (AEO): a 40–60 word direct answer, question-shaped H2s, FAQs.
// Inline links use [text](/path). Keep claims verifiable — no invented statistics.
import { article as howToMeasureGeo } from "./guides/how-to-measure-geo";
import { article as aiReadinessVsAiVisibility } from "./guides/ai-readiness-vs-ai-visibility";
import { article as trackBrandMentionsInChatgpt } from "./guides/track-brand-mentions-in-chatgpt";
import { article as improveAiSearchVisibility } from "./guides/improve-ai-search-visibility";
import { article as seoAuditCostIndia } from "./guides/seo-audit-cost-india";
import { article as bestAiVisibilityTools } from "./guides/best-ai-visibility-tools";
import { article as robotsTxtForAiCrawlers } from "./guides/robots-txt-for-ai-crawlers";
import { article as howToRankOnChatgpt } from "./guides/how-to-rank-on-chatgpt";
import { article as googleAiOverview } from "./guides/google-ai-overview";
import { article as faqSchemaExample } from "./guides/faq-schema-example";

/** Guides added 24 Nov 2026 (SEO keyword plan), one file each in ./guides. */
const GUIDES = [
  howToMeasureGeo,
  aiReadinessVsAiVisibility,
  trackBrandMentionsInChatgpt,
  improveAiSearchVisibility,
  seoAuditCostIndia,
  bestAiVisibilityTools,
  robotsTxtForAiCrawlers,
  howToRankOnChatgpt,
  googleAiOverview,
  faqSchemaExample,
];


export type ArticleSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  /** Ordered steps render as a numbered list after the paragraphs. */
  steps?: string[];
  /** A comparison table (rendered as a real <table> — answer engines lift tables readily). */
  table?: { head: string[]; rows: string[][] };
  /** A copy-paste code sample (rendered as <pre><code>, after the other blocks). */
  code?: string;
};

export type Article = {
  slug: string;
  /** H1 on the page. */
  title: string;
  /** <title> tag (the layout appends " · MyWebRank"). Lead with the searched phrase. */
  metaTitle: string;
  description: string;
  /** The search phrases this page is built for (first = primary). */
  keywords: string[];
  published: string;
  updated: string;
  /** The direct answer shown first — what answer engines and AI Overviews quote. */
  answer: string;
  /** Short key facts; easy for AI assistants to lift as a list. */
  keyPoints: string[];
  sections: ArticleSection[];
  faqs: { q: string; a: string }[];
  related: string[];
  /** Where the page sends readers next. */
  cta: { label: string; href: string };
  /** Primary sources the guide relies on (official docs, standards, research). Rendered as outbound links. */
  sources: { label: string; url: string }[];
};

const SRC = {
  seoStarter: { label: "Google Search Central: SEO Starter Guide", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" },
  aiFeatures: { label: "Google Search Central: AI features and your website", url: "https://developers.google.com/search/docs/appearance/ai-features" },
  featuredSnippets: { label: "Google Search Central: featured snippets", url: "https://developers.google.com/search/docs/appearance/featured-snippets" },
  faqPageGoogle: { label: "Google Search Central: FAQ (FAQPage) structured data", url: "https://developers.google.com/search/docs/appearance/structured-data/faqpage" },
  faqChanges2023: { label: "Google Search Central blog: changes to HowTo and FAQ rich results (August 2023)", url: "https://developers.google.com/search/blog/2023/08/howto-faq-changes" },
  structuredData: { label: "Google Search Central: introduction to structured data", url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
  titles: { label: "Google Search Central: title links", url: "https://developers.google.com/search/docs/appearance/title-link" },
  snippets: { label: "Google Search Central: meta descriptions and snippets", url: "https://developers.google.com/search/docs/appearance/snippet" },
  sitemaps: { label: "Google Search Central: sitemaps overview", url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview" },
  robotsIntro: { label: "Google Search Central: introduction to robots.txt", url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro" },
  doINeedSeo: { label: "Google Search Central: Do you need an SEO?", url: "https://developers.google.com/search/docs/fundamentals/do-i-need-seo" },
  spamPolicies: { label: "Google Search Central: spam policies", url: "https://developers.google.com/search/docs/essentials/spam-policies" },
  helpfulContent: { label: "Google Search Central: creating helpful, reliable, people-first content", url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content" },
  webVitals: { label: "web.dev: Core Web Vitals", url: "https://web.dev/articles/vitals" },
  rfc9309: { label: "IETF RFC 9309: Robots Exclusion Protocol", url: "https://datatracker.ietf.org/doc/html/rfc9309" },
  geoPaper: { label: "Aggarwal et al. (2023): GEO: Generative Engine Optimization (arXiv)", url: "https://arxiv.org/abs/2311.09735" },
  schemaFaq: { label: "schema.org: FAQPage", url: "https://schema.org/FAQPage" },
  schemaOrg: { label: "schema.org: Organization", url: "https://schema.org/Organization" },
  schemaLocal: { label: "schema.org: LocalBusiness", url: "https://schema.org/LocalBusiness" },
  llmsTxt: { label: "The llms.txt proposal (llmstxt.org)", url: "https://llmstxt.org/" },
} satisfies Record<string, { label: string; url: string }>;

const CORE_ARTICLES: Article[] = [
  {
    slug: "what-is-aeo",
    title: "What is AEO (Answer Engine Optimization)?",
    metaTitle: "What is AEO? Answer Engine Optimization guide",
    description:
      "AEO (Answer Engine Optimization) helps Google snippets, AI Overviews and ChatGPT quote your answer. What it is, how it differs from SEO and how to start.",
    keywords: ["what is AEO", "answer engine optimization", "AEO SEO", "AEO meaning", "answer engine optimisation"],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "AEO (Answer Engine Optimization) is the practice of structuring your content so answer engines — Google featured snippets and AI Overviews, voice assistants, ChatGPT, Perplexity and Gemini — can pick up your page and quote it as the direct answer to a question. SEO earns you a link in a list; AEO earns you the answer itself.",
    keyPoints: [
      "AEO targets questions, not just keywords: “how much does X cost”, “what is the best Y near me”.",
      "Answer engines prefer a short, direct answer (about 40–60 words) placed right under a question-shaped heading.",
      "FAQPage, Organization and Product structured data help engines understand what each answer is about.",
      "AEO builds on SEO: a page that can’t be crawled or indexed can’t be quoted.",
    ],
    sections: [
      {
        id: "definition",
        heading: "What does AEO mean?",
        paragraphs: [
          "An answer engine is any system that replies to a question with an answer instead of a list of links. Google’s featured snippets and AI Overviews, Alexa and Siri, and AI assistants such as ChatGPT, Gemini, Perplexity and Claude all work this way.",
          "Answer Engine Optimization (AEO) is the work of making your pages the source those systems choose. In practice it means finding the exact questions your customers ask, answering each one clearly near the top of a page, and marking the page up so machines know which text is the question and which is the answer.",
        ],
      },
      {
        id: "aeo-vs-seo",
        heading: "How is AEO different from SEO?",
        paragraphs: [
          "Classic SEO optimises a page to rank in the ten blue links. AEO optimises a passage on that page to be extracted as the answer. The two share foundations — crawlability, speed, authority, helpful content — but AEO adds a focus on question research, answer formatting and structured data.",
          "A useful way to think about it: SEO decides whether you are in the room, AEO decides whether you get to speak. For the AI-assistant side of the picture, see [What is GEO?](/learn/what-is-geo) and the side-by-side comparison in [SEO vs AEO vs GEO](/learn/seo-vs-aeo-vs-geo).",
        ],
      },
      {
        id: "why-it-matters",
        heading: "Why does AEO matter now?",
        paragraphs: [
          "More searches now end on the results page or inside an AI chat, because the answer is shown directly. If your page is not the one quoted, a competitor’s is — even if you rank on page one.",
          "Answers are also where trust is built. When Google or ChatGPT names your business as the answer to “who is the best … in Pune”, that recommendation carries more weight than an ad.",
          "The shift is recent. Google launched AI Overviews in the United States in May 2024 and expanded them to India and several other countries in August 2024. In August 2023 Google also limited FAQ rich results to well-known government and health websites, so FAQ markup now mainly helps machines understand your answers rather than earning a drop-down in results. Our guide to [Google AI Overviews](/learn/google-ai-overview) explains how those answers pick their sources.",
        ],
      },
      {
        id: "how-to-do-aeo",
        heading: "How do you do AEO? A step-by-step checklist",
        paragraphs: ["Start with the pages that already get some traffic, then work outwards."],
        steps: [
          "List the real questions customers ask — from sales calls, WhatsApp chats, Google’s “People also ask” box and AI assistants themselves. The free [FAQ generator](/tools/faq-generator) can suggest more questions to start from.",
          "Give each important question its own heading, written the way people ask it (“How much does a website audit cost?”).",
          "Put a direct 40–60 word answer immediately under the heading, then add detail, examples and numbers below it.",
          "Use lists and tables for steps, comparisons and prices — engines lift these formats readily.",
          "Add FAQPage structured data for question-and-answer blocks that are visible on the page (our free [FAQ schema generator](/tools/faq-schema-generator) writes it for you).",
          "Make sure the page is indexable, fast and has a clear title and meta description — AEO sits on top of good [technical SEO](/learn/website-seo-audit-checklist).",
          "Show who is answering: author or company name, date updated, contact details. Engines favour sources they can trust.",
          "Re-check every month which questions you are quoted for, and rewrite answers that are being skipped.",
        ],
      },
      {
        id: "measure",
        heading: "How do you measure AEO results?",
        paragraphs: [
          "Track featured-snippet and AI Overview appearances in Google Search Console and rank trackers, and sample the answers AI assistants give to your target questions. Because AI answers vary from one try to the next, measure over many samples and look at the rate, not a single screenshot.",
          `For a quick look, the free [AI visibility checker](/tools/ai-visibility-checker) asks ChatGPT, Gemini and Perplexity whether they name your business. ${"MyWebRank"}’s paid plan repeats those checks every week and shows how often you are named and linked. You can start with the [free website check](/free-check), which scores your AEO alongside SEO, GEO and Brand.`,
        ],
      },
    ],
    faqs: [
      { q: "Is AEO the same as SEO?", a: "No. AEO builds on SEO. SEO helps a page rank in search results; AEO helps a specific answer on that page get quoted by featured snippets, AI Overviews, voice assistants and AI chatbots." },
      { q: "What is an example of AEO?", a: "A plumber’s page with the heading “How much does it cost to fix a leaking tap in Mumbai?” followed by a two-sentence answer with a price range, plus FAQ structured data, so Google and ChatGPT can quote it directly." },
      { q: "Does AEO replace SEO?", a: "No. An answer engine can only quote pages it can crawl, index and trust, so SEO remains the foundation. AEO is an extra layer focused on questions and answer formatting." },
      { q: "How long does AEO take to work?", a: "Formatting changes can be picked up within days to a few weeks after a page is re-crawled. Winning competitive questions usually also needs authority, which takes months." },
    ],
    related: ["google-ai-overview", "seo-vs-aeo-vs-geo", "what-is-geo"],
    cta: { label: "Check your AEO score free", href: "/free-check" },
    sources: [SRC.featuredSnippets, SRC.aiFeatures, SRC.faqPageGoogle, SRC.faqChanges2023, SRC.schemaFaq],
  },
  {
    slug: "what-is-geo",
    title: "What is GEO (Generative Engine Optimization) in SEO?",
    metaTitle: "What Is GEO in SEO? Generative Engine Optimization",
    description:
      "What GEO means in SEO, how generative engine optimization works, and simple steps to get your brand named in ChatGPT, Gemini and AI Overviews.",
    keywords: ["what is GEO", "what is GEO in SEO", "generative engine optimization", "GEO SEO", "AI search optimization", "LLM SEO"],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "GEO (Generative Engine Optimization) is the practice of making your brand, pages and facts easy for generative AI — ChatGPT, Gemini, Perplexity, Claude and Google AI Overviews — to find, understand, trust and cite, so your business is named and linked inside AI-written answers. The term comes from a 2023 research paper by Princeton and partner researchers.",
    keyPoints: [
      "GEO is measured by how often AI answers mention you, link to you and describe you correctly.",
      "AI assistants that search the web mostly draw on existing search indexes (Google, Bing) plus their own crawlers, so SEO is still step one.",
      "Clear entity information (who you are, what you do, where) and consistent facts across the web help AI describe you correctly.",
      "Being cited on third-party sites AI trusts — directories, reviews, comparisons, news — matters as much as your own pages.",
    ],
    sections: [
      {
        id: "definition",
        heading: "What is GEO in SEO?",
        paragraphs: [
          "In SEO, GEO is the part of the work aimed at AI answers rather than the list of Google results. Generative engines write a fresh answer to every question by combining what a language model already knows with pages it retrieves from the web. GEO is about influencing both parts: being retrievable and quotable when the engine searches, and being well known and consistently described across the web so the model “knows” you.",
          "The name was introduced in the 2023 paper “GEO: Generative Engine Optimization” (Aggarwal et al.), which found that adding clear statistics, quotations and cited sources to a page made it noticeably more likely to be used in generated answers.",
        ],
      },
      {
        id: "how-ai-picks",
        heading: "How do ChatGPT, Gemini and Perplexity choose which brands to mention?",
        paragraphs: [
          "Each assistant works differently, but the pattern is similar. When a question needs fresh or local information, the assistant runs a web search, reads a handful of top pages and writes an answer citing some of them. ChatGPT search uses its own OAI-SearchBot crawler plus search partners; Gemini and AI Overviews use Google’s index; Perplexity runs its own crawler and index.",
          "So a brand gets mentioned when (1) its pages are crawlable by those bots, (2) it appears in the pages the assistant retrieves — its own site and third-party lists, reviews and articles — and (3) the facts about it are clear and consistent enough for the model to repeat confidently.",
        ],
      },
      {
        id: "geo-checklist",
        heading: "How do you do GEO? What to fix first",
        paragraphs: ["These steps are ordered by impact for most small and mid-sized businesses."],
        steps: [
          "Let AI crawlers in: check robots.txt allows GPTBot, OAI-SearchBot, PerplexityBot and ClaudeBot, and that your firewall or CDN isn’t blocking them. Also check robots.txt doesn’t disallow Google-Extended (a control token for Gemini, not a separate crawler). The free [AI crawler checker](/tools/ai-crawler-checker) tests this in one go, and our guide to [robots.txt for AI crawlers](/learn/robots-txt-for-ai-crawlers) shows the exact lines.",
          "Get indexed by both Google and Bing — submit your sitemap in Google Search Console and Bing Webmaster Tools, and use IndexNow for fast updates.",
          "Make your entity unmistakable: the same business name, address, phone and description everywhere, an About page, and Organization structured data with links to your official profiles (sameAs).",
          "Write citable pages: specific facts, prices, numbers, dates and named sources; one clear claim per paragraph; comparison tables.",
          "Earn mentions on the third-party pages AI already cites for your category — “best X in [city]” lists, review sites, directories, industry media and Reddit/Quora discussions.",
          "Publish an llms.txt file that summarises who you are and links your key pages ([what llms.txt is](/learn/llms-txt-guide)).",
          "Measure AI mentions over many sampled answers per month and fix wrong facts at the source.",
        ],
      },
      {
        id: "geo-vs-seo",
        heading: "Is GEO replacing SEO?",
        paragraphs: [
          "No. Most generative answers that use the web are grounded in pages that already rank well in search. GEO extends SEO with entity clarity, citation-worthy writing and off-site mentions, and measures success differently: share of AI answers instead of position on a results page. The full comparison is in [SEO vs AEO vs GEO](/learn/seo-vs-aeo-vs-geo).",
        ],
      },
      {
        id: "measure",
        heading: "How do you measure GEO?",
        paragraphs: [
          "Pick 20–100 questions your buyers ask, ask each AI assistant those questions repeatedly, and record how often you are named, linked and recommended — and how often competitors are. Report rates with the sample size, because single answers vary. Our step-by-step guide on [how to measure GEO](/learn/how-to-measure-geo) covers the method in detail.",
          "For a quick first look, the free [AI visibility checker](/tools/ai-visibility-checker) asks ChatGPT, Gemini and Perplexity whether they name your business. MyWebRank’s paid plan repeats those checks every week and turns the gaps into a fix list. Try the [free website check](/free-check) to see your GEO score today.",
        ],
      },
    ],
    faqs: [
      { q: "What is the difference between GEO and SEO?", a: "SEO aims to rank pages in search results. GEO aims to get a brand named, described correctly and cited inside AI-generated answers from ChatGPT, Gemini, Perplexity, Claude and Google AI Overviews. GEO depends on SEO but adds entity clarity, citable content and off-site mentions." },
      { q: "Who coined the term Generative Engine Optimization?", a: "The term was introduced in the 2023 research paper “GEO: Generative Engine Optimization” by Pranjal Aggarwal and colleagues from Princeton University and partner institutions. It is freely available to read on arXiv." },
      { q: "Can you pay to appear in ChatGPT answers?", a: "Organic ChatGPT answers cannot be bought. Brands appear because their pages and third-party mentions are retrieved and trusted. Be wary of anyone who guarantees AI mentions." },
      { q: "Does blocking GPTBot stop my site appearing in ChatGPT?", a: "Blocking GPTBot stops OpenAI using your pages for model training. Appearing in ChatGPT search results depends on OAI-SearchBot, which is a separate user agent. Most businesses that want visibility allow both." },
    ],
    related: ["how-to-measure-geo", "seo-vs-aeo-vs-geo", "how-to-get-mentioned-by-chatgpt"],
    cta: { label: "See if AI mentions you", href: "/free-check" },
    sources: [SRC.geoPaper, SRC.aiFeatures, SRC.rfc9309, SRC.schemaOrg],
  },
  {
    slug: "seo-vs-aeo-vs-geo",
    title: "SEO vs AEO vs GEO: what’s the difference?",
    metaTitle: "SEO vs AEO vs GEO: Differences Explained Simply",
    description:
      "SEO vs AEO vs GEO in plain words: what each one optimises for, where they overlap, and which your business needs first.",
    keywords: ["SEO vs AEO vs GEO", "AEO vs GEO", "SEO vs GEO", "difference between SEO AEO GEO", "SEO AEO GEO"],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "SEO (Search Engine Optimization) helps your pages rank in Google and Bing results. AEO (Answer Engine Optimization) helps a specific answer on your page get quoted in featured snippets, AI Overviews and voice results. GEO (Generative Engine Optimization) helps your brand get named and cited inside AI-written answers from ChatGPT, Gemini, Perplexity and Claude. They stack: SEO first, then AEO, then GEO.",
    keyPoints: [
      "SEO goal: rank. Metric: positions, clicks, impressions.",
      "AEO goal: be the quoted answer. Metric: featured snippets, AI Overview inclusions, “People also ask” wins.",
      "GEO goal: be named and linked by AI assistants. Metric: share of AI answers that mention or cite you.",
      "All three need the same foundation: a crawlable, fast, trustworthy site with clear content.",
    ],
    sections: [
      {
        id: "table",
        heading: "SEO, AEO and GEO side by side",
        paragraphs: [
          "The quickest way to see the difference is to compare where each one wins and how it is measured. For a deeper look at each, read [what AEO is](/learn/what-is-aeo) and [what GEO is in SEO](/learn/what-is-geo).",
        ],
        table: {
          head: ["", "SEO", "AEO", "GEO"],
          rows: [
            ["Full name", "Search Engine Optimization", "Answer Engine Optimization", "Generative Engine Optimization"],
            ["Where you win", "Google and Bing results pages", "Featured snippets, AI Overviews, voice assistants, “People also ask”", "ChatGPT, Gemini, Perplexity, Claude, Copilot and Grok answers"],
            ["What you optimise", "Whole pages for search phrases", "Individual answers to questions", "Your brand as an entity and your citable facts"],
            ["Key tactics", "Technical health, content, links", "Question headings, 40–60 word answers, FAQ structured data", "AI crawler access, consistent business details, third-party mentions, statistics and sources, llms.txt"],
            ["How you measure", "Rankings, impressions, organic clicks", "Snippet and AI Overview appearances", "Mention and citation rate across sampled AI answers"],
          ],
        },
      },
      {
        id: "overlap",
        heading: "Where do SEO, AEO and GEO overlap?",
        paragraphs: [
          "Most of the work is shared. Search engines and AI assistants both reward pages that load fast, are easy to crawl, answer questions directly and come from a source with a clear identity and a good reputation. That’s why a single audit can score all three — which is what the [MyWebRank report](/features) does.",
          "The labels are newer than the work. GEO was named in a 2023 research paper, [“GEO: Generative Engine Optimization”](https://arxiv.org/abs/2311.09735), which found that adding statistics, quotations and cited sources could raise a page’s visibility in AI answers by up to 40%. AEO grew out of Google’s [featured snippets](https://developers.google.com/search/docs/appearance/featured-snippets), and Google began showing AI Overviews in the United States in May 2024.",
        ],
      },
      {
        id: "which-first",
        heading: "Which should a small business do first?",
        paragraphs: ["Work in this order — each layer depends on the one before it. A page that Google cannot crawl or index will not be quoted as an answer, and an AI assistant is unlikely to name a business whose own website is unclear about what it does."],
        steps: [
          "Fix SEO basics: indexing, titles and meta descriptions, page speed, mobile layout, HTTPS, a sitemap ([checklist](/learn/website-seo-audit-checklist)).",
          "Add AEO: rewrite key pages around customer questions with direct answers and FAQ structured data.",
          "Add GEO: allow AI crawlers, make your business details consistent everywhere, get listed on the sites AI cites for your category, and track AI mentions monthly (the free [AI visibility checker](/tools/ai-visibility-checker) shows whether ChatGPT, Gemini and Perplexity name you today).",
        ],
      },
      {
        id: "examples",
        heading: "An example: one dental clinic, three goals",
        paragraphs: [
          "SEO: the clinic’s “Teeth whitening in Andheri” page ranks #3 on Google for that phrase.",
          "AEO: Google shows the clinic’s two-sentence answer to “How long does teeth whitening last?” in a featured snippet and the AI Overview.",
          "GEO: when someone asks ChatGPT “Which dental clinic in Andheri is good for whitening?”, the clinic is named, with a link, because it appears on several local review lists and its own site states prices and credentials clearly.",
          "Want to see where your own site stands on all three? The [free website check](/free-check) scores SEO, AEO and GEO (plus Brand) with no sign-up.",
        ],
      },
    ],
    faqs: [
      { q: "Is AEO or GEO more important than SEO?", a: "No. Both depend on SEO. A page that isn’t crawled and indexed can’t be quoted by an answer engine or retrieved by an AI assistant, so SEO remains the foundation." },
      { q: "Do I need a separate agency for AEO and GEO?", a: "Not necessarily. Most of the work overlaps with good SEO. What’s different is measurement: you need to track AI answers, not just rankings. A tool or service that reports all three avoids duplicated work." },
      { q: "What is AIO or LLMO?", a: "AIO (AI optimization) and LLMO (large language model optimization) are other names people use for roughly the same idea as GEO: getting a brand mentioned and cited by AI assistants." },
    ],
    related: ["what-is-aeo", "what-is-geo", "improve-ai-search-visibility"],
    cta: { label: "Get your SEO, AEO & GEO scores", href: "/free-check" },
    sources: [SRC.seoStarter, SRC.featuredSnippets, SRC.aiFeatures, SRC.geoPaper],
  },
  {
    slug: "how-to-get-mentioned-by-chatgpt",
    title: "How to get my business on ChatGPT (and Gemini and Perplexity)",
    metaTitle: "How to Get Your Business on ChatGPT and Recommended",
    description:
      "How to get your business found and recommended on ChatGPT. The reviews, listings, content and schema AI looks for, plus a free way to check.",
    keywords: [
      "how to get my business on ChatGPT",
      "how to get your business recommended on ChatGPT",
      "how to get my business found on ChatGPT",
      "get mentioned by ChatGPT",
      "ChatGPT SEO",
      "AI visibility",
      "Perplexity SEO",
    ],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "To get your business on ChatGPT and other AI assistants: let their crawlers into your site, get indexed in both Google and Bing, state who you are and what you offer clearly and consistently, publish pages that directly answer buyer questions with specific facts, and get listed on the third-party pages AI already cites for your category. Then measure mentions over many sampled answers each month.",
    keyPoints: [
      "There is no paid placement in organic ChatGPT answers — mentions are earned.",
      "OAI-SearchBot (ChatGPT search), PerplexityBot and Claude-SearchBot must be allowed in robots.txt and not blocked by your firewall.",
      "AI assistants often cite list-style pages: “best X in Y”, comparisons, reviews and directories.",
      "Consistency matters: if your address or services differ across sites, AI is less likely to describe you confidently.",
    ],
    sections: [
      {
        id: "step-1",
        heading: "Step 1: Can AI crawlers read your website?",
        paragraphs: [
          "Open yoursite.com/robots.txt and check that GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot and the Google-Extended token are not disallowed. Then check your CDN or security plugin — Cloudflare and some WordPress plugins block AI bots by default. The rules in robots.txt follow an internet standard, [RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309), published by the IETF in 2022. The free [AI crawler checker](/tools/ai-crawler-checker) tests each bot for you, and our guide to [robots.txt for AI crawlers](/learn/robots-txt-for-ai-crawlers) shows what to change.",
          "Also make sure your important content is in the HTML, not only rendered by JavaScript. Many AI crawlers don’t run JavaScript. Our [free website check](/free-check) tests all of this in about 30 seconds.",
        ],
      },
      {
        id: "step-2",
        heading: "Step 2: Are you indexed in Google and Bing?",
        paragraphs: [
          "AI assistants that browse the web lean heavily on established search indexes. Submit your sitemap to Google Search Console and Bing Webmaster Tools, fix any “not indexed” pages, and use IndexNow so Bing hears about new pages within minutes.",
        ],
      },
      {
        id: "step-3",
        heading: "Step 3: Is it obvious who you are?",
        paragraphs: [
          "AI assistants describe entities. Give yours a clear, repeated definition: one sentence that says what you do, for whom and where — on your home page, About page, Google Business Profile, LinkedIn and directory listings. This is the heart of [GEO (Generative Engine Optimization)](/learn/what-is-geo).",
        ],
        bullets: [
          "Same business name, address and phone number everywhere.",
          "An About page with founders, founding year, location and credentials.",
          "Organization (or LocalBusiness) structured data with sameAs links to your official profiles.",
          "An llms.txt file summarising your business and key pages ([how to write one](/learn/llms-txt-guide)).",
        ],
      },
      {
        id: "step-4",
        heading: "Step 4: Do your pages answer buyer questions?",
        paragraphs: [
          "Ask ChatGPT the questions your customers ask — “best accounting software for small business in India”, “how much does a website cost in Delhi” — and look at what it cites. Then make sure you have a page that answers that exact question better: a direct answer first, then prices, numbers, comparisons and named sources.",
          "Pages with concrete, checkable facts are easier for AI to quote than vague marketing copy. A 2023 study, [“GEO: Generative Engine Optimization”](https://arxiv.org/abs/2311.09735), found that adding statistics, quotations and cited sources could raise a page’s visibility in AI-generated answers by up to 40%.",
        ],
      },
      {
        id: "step-5",
        heading: "Step 5: Are you on the pages AI trusts?",
        paragraphs: [
          "For most commercial questions, AI assistants cite third-party pages: top-10 lists, review platforms, directories, industry publications and forum threads. Find the pages cited for your category and get onto them — by asking for inclusion, offering data or a quote, or earning reviews.",
          "MyWebRank’s “Outside your website” list shows which sites AI links to most in your category so you know where to focus.",
        ],
      },
      {
        id: "step-6",
        heading: "Step 6: How do you know your business is found on ChatGPT?",
        paragraphs: [
          "AI answers change from one try to the next, so a single screenshot proves little. Ask the same set of questions repeatedly across assistants and track the rate at which you’re named and linked, compared with competitors. Our guide to [tracking brand mentions in ChatGPT](/learn/track-brand-mentions-in-chatgpt) walks through a simple method.",
          "For a quick first answer, the free [AI visibility checker](/tools/ai-visibility-checker) asks ChatGPT, Gemini and Perplexity whether they name your business. [MyWebRank](/how-it-works) repeats those checks every week on the paid plan and turns gaps into a fix list.",
        ],
      },
    ],
    faqs: [
      { q: "How do I get my business recommended on ChatGPT?", a: "Being recommended, not just mentioned, needs proof that others vouch for you: reviews, places on “best X in [city]” lists, and clear prices and credentials on your own site. Do the six steps above, then ask ChatGPT your buyers’ questions every month to see whether it recommends you." },
      { q: "How do I get my business found on ChatGPT if it is new?", a: "Start with the basics a new business can control: allow AI crawlers, submit your sitemap to Google and Bing, create a Google Business Profile and a few directory listings with the same name, address and phone, and publish a clear About page. Mentions on other sites come next." },
      { q: "How long does it take to appear in ChatGPT answers?", a: "If you fix crawler access and indexing, ChatGPT search can pick up pages within days to weeks. Being recommended for competitive questions usually takes several months of content and third-party mentions." },
      { q: "Can I guarantee my business will be recommended by ChatGPT?", a: "No one can guarantee it. AI answers vary and depend on many sources. What you can do is remove barriers, publish citable content and earn mentions — and measure the rate honestly." },
      { q: "Does ChatGPT use Google or Bing?", a: "ChatGPT search uses OpenAI’s own crawler (OAI-SearchBot) together with third-party search providers; Microsoft Bing has historically been a major partner. Being well indexed in Bing as well as Google is a sensible step." },
      { q: "Does Google AI Overviews use the same signals?", a: "AI Overviews are generated from Google’s own search index, so normal Google SEO — indexing, helpful content, authority — is what gets you included. Google says there are no extra requirements or special files needed to appear in them." },
    ],
    related: ["track-brand-mentions-in-chatgpt", "how-to-rank-on-chatgpt", "what-is-geo"],
    cta: { label: "Check if AI can find you", href: "/free-check" },
    sources: [SRC.geoPaper, SRC.rfc9309, SRC.aiFeatures, SRC.schemaOrg, SRC.schemaLocal],
  },
  {
    slug: "website-seo-audit-checklist",
    title: "Website SEO audit checklist (with AEO and GEO checks)",
    metaTitle: "Website SEO audit checklist (2026, free)",
    description:
      "Website SEO audit checklist for 2026, plus how to do an SEO audit for a small business: indexing, titles, speed, mobile, AEO and GEO checks, step by step.",
    keywords: [
      "website SEO audit",
      "SEO audit checklist",
      "how to do an SEO audit for a small business",
      "website SEO report",
      "SEO checker",
      "technical SEO audit",
      "web report",
    ],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "A website SEO audit checks whether search engines and AI assistants can crawl, index, understand and trust your pages. The essentials are: indexing and sitemap, HTTPS, unique titles and meta descriptions, one clear H1 per page, fast mobile pages (Core Web Vitals), internal links, structured data, and — for AI search — AI crawler access, direct answers and consistent business details.",
    keyPoints: [
      "Start with indexing: a page that isn’t indexed can’t rank or be quoted.",
      "Every page needs a unique title (under ~60 characters) and meta description (under ~155 characters).",
      "Core Web Vitals: LCP under 2.5 s, INP under 200 ms, CLS under 0.1.",
      "Add AEO/GEO checks: AI bots allowed, FAQ structured data, entity details, llms.txt.",
    ],
    sections: [
      {
        id: "crawl-index",
        heading: "1. Crawling and indexing",
        paragraphs: ["These decide whether Google, Bing and AI assistants can see your pages at all."],
        bullets: [
          "robots.txt doesn’t block important pages, CSS or JavaScript.",
          "An XML sitemap lists every page you want found, and is submitted in Google Search Console and Bing Webmaster Tools.",
          "No accidental noindex tags on key pages.",
          "Each page has one canonical URL; http→https and www/non-www redirect to it.",
          "No broken internal links (404s) or redirect chains.",
        ],
      },
      {
        id: "on-page",
        heading: "2. On-page SEO",
        paragraphs: [],
        bullets: [
          "Unique, descriptive title tag on every page, with the main phrase near the start.",
          "Meta description that summarises the page and invites the click (check both with the [meta tag checker](/tools/meta-tag-checker), or draft one with the [meta description generator](/tools/meta-description-generator)).",
          "Exactly one H1 that matches the page’s topic; logical H2/H3 structure (see the outline with the [heading checker](/tools/heading-checker)).",
          "Descriptive image alt text and compressed images.",
          "Clean, readable URLs.",
          "Internal links from related pages using descriptive anchor text.",
        ],
      },
      {
        id: "performance",
        heading: "3. Speed, mobile and security",
        paragraphs: [],
        bullets: [
          "Core Web Vitals pass on mobile (check PageSpeed Insights).",
          "The layout works on a 360 px wide phone without sideways scrolling.",
          "HTTPS everywhere, with no mixed-content warnings.",
        ],
      },
      {
        id: "structured-data",
        heading: "4. Structured data",
        paragraphs: [
          "Structured data (schema markup) tells engines what a page is about in a machine-readable way. Validate it with Google’s Rich Results Test.",
        ],
        bullets: [
          "Organization or LocalBusiness on the home page, with logo, contact and sameAs links.",
          "FAQPage for visible question-and-answer sections ([free FAQ schema generator](/tools/faq-schema-generator)).",
          "Product, Service, Article or BreadcrumbList where they fit.",
        ],
      },
      {
        id: "aeo",
        heading: "5. AEO checks (answer engines)",
        paragraphs: ["These checks decide whether Google and AI assistants can quote your answer directly ([what AEO is](/learn/what-is-aeo))."],
        bullets: [
          "Key pages are built around the questions customers ask.",
          "Each question heading is followed by a direct 40–60 word answer.",
          "Steps, comparisons and prices are in lists or tables.",
          "Author or company and “last updated” date are visible.",
        ],
      },
      {
        id: "geo",
        heading: "6. GEO checks (AI assistants)",
        paragraphs: [],
        bullets: [
          "GPTBot, OAI-SearchBot, PerplexityBot and ClaudeBot are allowed in robots.txt and not blocked by the firewall; Google-Extended (a robots.txt token, not a crawler) is not disallowed.",
          "Main content is in the HTML, not only rendered by JavaScript.",
          "Business name, address, phone and description are identical across your site and listings.",
          "An llms.txt file summarises the business ([free llms.txt generator](/tools/llms-txt-generator)).",
          "You are listed on the third-party sites AI cites for your category.",
        ],
      },
      {
        id: "small-business-audit",
        heading: "How to do an SEO audit for a small business",
        paragraphs: [
          "You don’t need to be an expert or buy an expensive tool. Set aside an afternoon, open a notepad, and work through these steps in order. Fix the problems you find from the top of the list down — the early steps matter most.",
        ],
        steps: [
          "Run a [free website check](/free-check) on your home page. It scores SEO, AEO, GEO and Brand and lists the biggest problems in plain words, so you know where to start.",
          "Search Google for your business name and for “site:” followed by your domain. If key pages are missing, sign up for Google Search Console (free) and submit your sitemap.",
          "Open your five most important pages — home, main services, prices, about, contact. Check each has its own Google headline (title) and summary, and one main heading that says what the page is about.",
          "Open each of those pages on your phone. Text should be readable without zooming, buttons easy to tap, and the page should load in a few seconds.",
          "Check your business name, address, phone and opening hours match on your website, Google Business Profile and the main directories in your area.",
          "Write down the five questions customers ask you most, and make sure your site answers each one clearly near the top of a page.",
          "Ask ChatGPT or Gemini “best [your service] in [your city]” and note whether you are named and which sites it mentions.",
          "Put the fixes in order and do one or two a week. If you’d rather not do the work yourself, our [SEO services for small businesses](/seo-services-small-business) team can do it for you.",
        ],
      },
      {
        id: "report",
        heading: "How do I get an automated SEO report?",
        paragraphs: [
          "Running this list by hand takes hours. The [MyWebRank free website check](/free-check) scores your home page and up to four more pages for SEO, AEO, GEO and Brand in about 30 seconds, explains each problem in plain words and lists the fixes. See [pricing](/pricing) for weekly checks and monthly tracking, or read [what an SEO audit costs in India](/learn/seo-audit-cost-india) if you are comparing agencies.",
        ],
      },
    ],
    faqs: [
      { q: "How often should I audit my website for SEO?", a: "Run a full audit at least every quarter and after any redesign, migration or platform change. Monthly automated checks catch new problems — broken links, accidental noindex tags — before they cost traffic." },
      { q: "What is the best free SEO audit tool?", a: "Google Search Console and PageSpeed Insights are free and essential. For a combined SEO, AEO and GEO score with plain-English fixes, the MyWebRank free website check needs no sign-up." },
      { q: "What should an SEO report include?", a: "A good SEO report covers indexing status, technical errors, on-page issues, speed and Core Web Vitals, structured data, backlinks or mentions, and a prioritised fix list. In 2026 it should also show visibility in AI answers." },
      { q: "How much does an SEO audit cost in India?", a: "Manual agency audits commonly range from a few thousand to over a lakh rupees depending on site size. Automated tools cost far less; MyWebRank offers a free check and paid plans with a free trial." },
    ],
    related: ["seo-audit-cost-india", "seo-vs-aeo-vs-geo", "how-to-choose-an-seo-company"],
    cta: { label: "Get your free SEO report", href: "/free-check" },
    sources: [SRC.seoStarter, SRC.titles, SRC.snippets, SRC.sitemaps, SRC.robotsIntro, SRC.structuredData, SRC.webVitals],
  },
  {
    slug: "llms-txt-guide",
    title: "llms.txt in SEO: what it is, what it does and whether you need one",
    metaTitle: "llms.txt in SEO: What It Is and Does It Help?",
    description:
      "What llms.txt does for SEO and AI search, what it can't do, and how to set it up the right way. An honest guide for site owners.",
    keywords: ["llms.txt in SEO", "what is llms.txt", "does llms.txt help SEO", "llms.txt", "llms-full.txt"],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "llms.txt is a proposed standard (llmstxt.org, 2024): a Markdown file at yoursite.com/llms.txt with your site’s name, a one-paragraph summary and a list of your most important pages with short descriptions. It gives AI tools a clean map of your site. It is cheap to add and harmless, but not every AI system reads it yet.",
    keyPoints: [
      "Location: the root of your domain, e.g. https://example.com/llms.txt.",
      "Format: an H1 with the name, a > blockquote summary, optional notes, then H2 sections of Markdown links.",
      "An optional llms-full.txt contains the full text of key pages in one file.",
      "It complements robots.txt and sitemap.xml — it doesn’t replace them.",
    ],
    sections: [
      {
        id: "format",
        heading: "What does an llms.txt file look like?",
        paragraphs: [
          "Here is the structure, in plain text: the first line is “# Your Business Name”. Next comes a line starting with “>” that summarises what you do, for whom and where. Then a few bullet points of key facts. Then sections such as “## Services” and “## Optional”, each a list of links in the form “- [Page title](full page address): one-line description”.",
          `You can see a live example at ${"MyWebRank"}’s own [llms.txt](/llms.txt) and the longer [llms-full.txt](/llms-full.txt).`,
        ],
      },
      {
        id: "example-bakery",
        heading: "llms.txt example 1: a local bakery",
        paragraphs: [
          "Below are three made-up businesses on made-up example domains, so you can see how the same format fits different kinds of business. Each table shows one line of the file per row, in order, with what that line is for. Copy the left column into a plain text file, leave a blank line between sections, and swap in your own details.",
          "First, a small local shop. Keep it short: what you sell, where you are, and the five or six pages a customer actually needs.",
        ],
        table: {
          head: ["Line in the file", "What it is for"],
          rows: [
            ["# Greenleaf Bakery", "The name of the business (the only H1)."],
            ["> Eggless cakes, breads and cookies baked fresh daily in Indiranagar, Bengaluru. Open 8am–9pm, home delivery within 5 km.", "The one-paragraph summary: what, where, for whom."],
            ["- Custom birthday cakes need 24 hours’ notice.", "A key fact AI tools should repeat correctly."],
            ["- All products are 100% eggless and vegetarian.", "Another key fact."],
            ["## Pages", "Start of the main list of pages."],
            ["- [Menu and prices](https://greenleaf-bakery.example.com/menu): all cakes, breads and cookies with prices in rupees", "A link plus a one-line description."],
            ["- [Order a custom cake](https://greenleaf-bakery.example.com/custom-cakes): sizes, flavours and how to order", "A link plus a one-line description."],
            ["- [Visit us](https://greenleaf-bakery.example.com/contact): address, map, phone and opening hours", "A link plus a one-line description."],
            ["## Optional", "Pages AI tools can skip if they are short on space."],
            ["- [Our story](https://greenleaf-bakery.example.com/about): founded in 2015 by two home bakers", "A lower-priority page."],
          ],
        },
      },
      {
        id: "example-b2b",
        heading: "llms.txt example 2: a B2B service company",
        paragraphs: [
          "A business-to-business firm usually has more pages. Group them under clear headings so AI tools can tell services from case studies.",
        ],
        table: {
          head: ["Line in the file", "What it is for"],
          rows: [
            ["# Northwind Payroll Services", "The company name."],
            ["> Payroll, PF and ESI compliance outsourcing for Indian companies with 20–500 employees. Based in Pune, serving clients across India.", "The summary: service, customer size, location."],
            ["- We do not offer recruitment or staffing services.", "A fact that stops AI tools describing you wrongly."],
            ["## Services", "Main service pages."],
            ["- [Payroll processing](https://northwind-payroll.example.com/payroll): monthly payroll, payslips and Form 16", "Link plus description."],
            ["- [PF and ESI compliance](https://northwind-payroll.example.com/compliance): registrations, monthly filings and inspections", "Link plus description."],
            ["- [Pricing](https://northwind-payroll.example.com/pricing): per-employee monthly fees", "Link plus description."],
            ["## Case studies", "Proof pages AI tools can cite."],
            ["- [Manufacturing client, 300 staff](https://northwind-payroll.example.com/case-studies/manufacturing): how payroll moved over in one month", "Link plus description."],
            ["## Optional", "Lower-priority pages."],
            ["- [Blog](https://northwind-payroll.example.com/blog): guides on payroll rules", "A page AI tools can skip."],
          ],
        },
      },
      {
        id: "example-store",
        heading: "llms.txt example 3: an online store",
        paragraphs: [
          "An online shop should point AI tools at category pages and the policies buyers ask about — shipping, returns, payment — rather than listing every product.",
          "When your own file is ready, the free [llms.txt generator](/tools/llms-txt-generator) can build the same structure from a short form, so you don’t have to type the Markdown by hand.",
        ],
        table: {
          head: ["Line in the file", "What it is for"],
          rows: [
            ["# Kora Handloom", "The store name."],
            ["> Handwoven cotton sarees, dupattas and home linen from weavers in Andhra Pradesh. Ships across India; cash on delivery available.", "The summary: products, origin, delivery."],
            ["## Shop", "Category pages, not every product."],
            ["- [Cotton sarees](https://kora-handloom.example.com/sarees): handwoven sarees with prices and fabric details", "Link plus description."],
            ["- [Home linen](https://kora-handloom.example.com/home): bedsheets, cushion covers and table linen", "Link plus description."],
            ["## Policies", "The answers buyers ask AI about most."],
            ["- [Shipping](https://kora-handloom.example.com/shipping): delivery times and charges by city", "Link plus description."],
            ["- [Returns and exchanges](https://kora-handloom.example.com/returns): 7-day return rules", "Link plus description."],
            ["## Optional", "Lower-priority pages."],
            ["- [Our weavers](https://kora-handloom.example.com/weavers): the families who make our products", "A page AI tools can skip."],
          ],
        },
      },
      {
        id: "does-it-work",
        heading: "Do ChatGPT and Google actually use llms.txt?",
        paragraphs: [
          "Honest answer: support is uneven. Some AI coding tools, documentation platforms and agents fetch llms.txt, and adoption is growing, but Google has said its search systems don’t rely on it and no major assistant has committed to using it for ranking. Treat it as a low-cost clarity signal, not a ranking trick.",
          "Google’s guide to [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) says you don’t need new machine-readable files to appear in AI Overviews. By contrast, robots.txt has been a formal internet standard, [RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309), since 2022, so get that file right before you worry about llms.txt.",
          "What matters more for AI visibility is crawler access, indexing, clear content and third-party mentions — see [how to get your business on ChatGPT](/learn/how-to-get-mentioned-by-chatgpt) and [robots.txt for AI crawlers](/learn/robots-txt-for-ai-crawlers).",
        ],
      },
      {
        id: "llms-txt-seo",
        heading: "Is llms.txt used for SEO?",
        paragraphs: [
          "Not for Google rankings. llms.txt is still a proposal, not an agreed standard, and Google does not use it to rank pages or to pick sources for AI Overviews. Adding one will not move you up in search results.",
          "Where it can help is with AI tools that choose to read it — some assistants, agents and coding tools fetch it to get a quick map of a site. So think of llms.txt as part of [GEO (Generative Engine Optimization)](/learn/what-is-geo), not classic SEO: a small, cheap extra that sits on top of the basics. To see whether those basics are in place, run the [free website check](/free-check).",
        ],
      },
      {
        id: "how-to-create",
        heading: "How to create an llms.txt file in 5 minutes",
        paragraphs: [],
        steps: [
          "Write one sentence that says what your business does, for whom and where.",
          "List your 5–15 most important pages: services, pricing, about, contact, top guides.",
          "Give each page a one-line description in plain language.",
          "Generate the file with the [free llms.txt generator](/tools/llms-txt-generator), or write it by hand in Markdown.",
          "Upload it to the root of your website so it opens at yoursite.com/llms.txt, and update it when key pages change.",
        ],
      },
    ],
    faqs: [
      { q: "Is llms.txt the same as robots.txt?", a: "No. robots.txt tells crawlers what they may or may not fetch. llms.txt is a human- and AI-readable summary of what your site is about and which pages matter. You should have both." },
      { q: "Does llms.txt improve SEO rankings?", a: "There is no evidence that llms.txt affects Google rankings. Its purpose is to help AI tools understand your site quickly. Rankings still depend on crawlable, indexable, genuinely helpful pages, so fix those first and treat llms.txt as a small extra." },
      { q: "Where do I upload llms.txt in WordPress?", a: "Upload it to your site’s root folder (the same folder as wp-config.php) using your host’s file manager or FTP, or use an SEO plugin that supports llms.txt." },
    ],
    related: ["robots-txt-for-ai-crawlers", "what-is-geo", "how-to-get-mentioned-by-chatgpt"],
    cta: { label: "Make your llms.txt free", href: "/tools/llms-txt-generator" },
    sources: [SRC.llmsTxt, SRC.aiFeatures, SRC.rfc9309, SRC.robotsIntro],
  },
  {
    slug: "how-to-choose-an-seo-company",
    title: "How to choose an SEO company in India (and red flags to avoid)",
    metaTitle: "How to choose an SEO company in India",
    description:
      "Hiring an SEO company in India? What good SEO, AEO and GEO work includes, typical prices, 10 questions to ask, and the red flags that mean walk away.",
    keywords: ["SEO company", "SEO company in India", "best SEO agency", "SEO services India", "hire SEO agency", "AI SEO agency"],
    published: "2026-11-09",
    updated: "2026-11-24",
    answer:
      "Choose an SEO company that starts with a written audit, agrees a clear monthly list of deliverables, reports progress with real data from Google Search Console and AI answers, and never guarantees #1 rankings. In 2026, a good agency should also cover AEO (answer engines) and GEO (AI assistants like ChatGPT), not just classic keyword rankings.",
    keyPoints: [
      "Ask for deliverables, not promises: what exactly will be done each month.",
      "Insist on access to your own Google Search Console, analytics and reports.",
      "Guaranteed rankings, secret methods and cheap bulk backlinks are red flags.",
      "Check that they measure AI visibility (ChatGPT, Gemini, AI Overviews), not only Google positions.",
    ],
    sections: [
      {
        id: "what-good-includes",
        heading: "What should a good SEO service include?",
        paragraphs: [
          "Before you call any agency, run a [free website check](/free-check) on your own site. You’ll know your starting scores, and you can see whether an agency’s audit finds the same problems.",
        ],
        bullets: [
          "A starting audit of technical SEO, content and competitors — written, not verbal (compare it with our [website SEO audit checklist](/learn/website-seo-audit-checklist)).",
          "Technical fixes: indexing, speed, mobile, structured data, internal links.",
          "Content: pages and answers built around what your customers actually ask.",
          "Local SEO: Google Business Profile, reviews and consistent listings.",
          "AEO and GEO: answer formatting, AI crawler access, entity clarity, AI mention tracking ([what GEO means](/learn/what-is-geo)).",
          "Monthly reports showing what was done and what changed, with evidence.",
        ],
      },
      {
        id: "questions",
        heading: "10 questions to ask before you hire an SEO agency",
        paragraphs: [],
        steps: [
          "What will you deliver in the first 30, 60 and 90 days?",
          "Can I see a sample monthly report?",
          "Will I own all accounts, content and data if we stop working together?",
          "How do you build links or mentions, and can you show examples?",
          "Who will actually do the work, and how often will we talk?",
          "How do you measure visibility in AI assistants like ChatGPT and Gemini?",
          "What changes will you make to my website, and do I approve them first?",
          "Can changes be rolled back if something breaks?",
          "What results have similar clients seen — and over what time frame?",
          "What is the notice period and what happens to work in progress?",
        ],
      },
      {
        id: "red-flags",
        heading: "Red flags: when to walk away",
        paragraphs: [],
        bullets: [
          "“Guaranteed #1 on Google” — Google itself says no one can guarantee a ranking.",
          "Hundreds of backlinks for a small fixed fee — usually spam that can hurt you.",
          "No access to your own Search Console or analytics data.",
          "Reports full of vanity numbers with no list of work done.",
          "Long lock-in contracts before any results.",
        ],
      },
      {
        id: "cost",
        heading: "How much does SEO cost in India?",
        paragraphs: [
          "Prices vary widely. Freelancers may charge a few thousand rupees a month; established agencies typically charge from about ₹15,000 to well over ₹1,00,000 a month depending on scope, competition and the number of pages. Compare on deliverables, not price alone. A one-off audit is priced differently — see [how much an SEO audit costs in India](/learn/seo-audit-cost-india).",
          "MyWebRank offers both routes: “Do it myself” software at ₹1,999/month + GST with a 7-day free trial, and a [done-for-you SEO, AEO and GEO service](/done-for-you) at ₹19,999/month + GST where our team does the agreed work every month and reports the impact. Small businesses can read more on our [SEO services for small businesses](/seo-services-small-business) page, or see [pricing](/pricing).",
        ],
      },
    ],
    faqs: [
      { q: "Which is the best SEO company in India?", a: "The best SEO company for you is one that audits first, agrees clear deliverables, gives you full data access, reports honestly and covers AI search (AEO and GEO) as well as Google. Compare two or three on those points rather than on promises." },
      { q: "Can an SEO company guarantee first-page rankings?", a: "No. Google states that no one can guarantee a #1 ranking. Reputable agencies guarantee the work they will deliver, not the position. Treat any promise of a guaranteed top spot as a red flag and ask exactly what will be done each month instead." },
      { q: "How long does SEO take to show results?", a: "Technical fixes can show results within weeks; competitive rankings and AI mentions usually take three to six months or more of consistent work. Ask for monthly reports that show the work done next to what changed, so you can judge progress honestly." },
      { q: "Should I hire an agency or use an SEO tool?", a: "If you have time and some skills, a tool that tells you exactly what to fix is cheaper. If you don’t, a done-for-you service saves time. MyWebRank offers both, so you can start with the tool and switch later." },
    ],
    related: ["seo-audit-cost-india", "website-seo-audit-checklist", "seo-vs-aeo-vs-geo"],
    cta: { label: "See done-for-you plans", href: "/done-for-you" },
    sources: [SRC.doINeedSeo, SRC.spamPolicies, SRC.helpfulContent, SRC.seoStarter],
  },
];

/** Every English guide: the original seven above, then the ones in src/lib/learn/guides/ (one file per guide). */
export const ARTICLES: Article[] = [...CORE_ARTICLES, ...GUIDES];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** Plain text of an article (links flattened) for llms-full.txt. */
export function articleToMarkdown(a: Article, base: string): string {
  const fixLinks = (s: string) => s.replace(/\]\((\/[^)]*)\)/g, (_, p: string) => `](${base}${p})`);
  const out: string[] = [`# ${a.title}`, "", `URL: ${base}/learn/${a.slug}`, `Updated: ${a.updated}`, "", `> ${a.answer}`, ""];
  out.push("Key points:", "", ...a.keyPoints.map((k) => `- ${k}`), "");
  for (const s of a.sections) {
    out.push(`## ${s.heading}`, "");
    for (const p of s.paragraphs) out.push(fixLinks(p), "");
    if (s.table) {
      out.push(`| ${s.table.head.join(" | ")} |`, `|${s.table.head.map(() => " --- ").join("|")}|`);
      out.push(...s.table.rows.map((r) => `| ${r.join(" | ")} |`), "");
    }
    if (s.bullets) out.push(...s.bullets.map((b) => `- ${fixLinks(b)}`), "");
    if (s.steps) out.push(...s.steps.map((b, i) => `${i + 1}. ${fixLinks(b)}`), "");
    if (s.code) out.push("```", s.code, "```", "");
  }
  out.push("## FAQ", "");
  for (const f of a.faqs) out.push(`### ${f.q}`, "", f.a, "");
  if (a.sources.length) out.push("## Sources", "", ...a.sources.map((s) => `- [${s.label}](${s.url})`), "");
  return out.join("\n");
}
