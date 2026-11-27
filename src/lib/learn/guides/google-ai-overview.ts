import type { Article } from "@/lib/learn/articles";

export const article: Article = {
  slug: "google-ai-overview",
  title: "How to show up in Google AI Overview: what Google actually says",
  metaTitle: "How to Show Up in Google AI Overview (2026 Guide)",
  description:
    "How to appear in Google AI Overview: what Google picks, how to structure your content, and how to check if your pages are being cited.",
  keywords: ["how to show up in google ai overview", "how to appear in google ai overview", "google ai overview seo", "ai overviews ranking"],
  published: "2026-11-24",
  updated: "2026-11-24",
  answer:
    "Google says there are no special requirements to appear in AI Overviews beyond normal SEO best practices. Your page must be indexed and eligible to show in Google Search with a snippet. After that, helpful people-first content, clear answer-first passages under question headings, and structured data that matches the page give Google good material to link.",
  keyPoints: [
    "No special file, tag or schema is needed for AI Overviews — Google says so in its “AI features and your website” guide.",
    "To be shown as a supporting link, a page must be indexed and eligible to appear in Search with a snippet.",
    "nosnippet, data-nosnippet and max-snippet also limit how your content is used in AI Overviews.",
    "Blocking Google-Extended does not remove you from AI Overviews; they use the normal Googlebot.",
    "AI Overviews launched in India in August 2024 and are now a regular part of Google results.",
  ],
  sections: [
    {
      id: "what-are-they",
      heading: "What is a Google AI Overview?",
      paragraphs: [
        "An AI Overview is the AI-written summary that appears at the top of some Google results, with links to the web pages it drew on. Google launched AI Overviews in the United States in May 2024 and expanded them to India and other countries in August 2024. Google also offers AI Mode, a chat-style search that works on the same principles.",
        "For a small business, the prize is the supporting link: your page shown as a source next to the summary. Someone searching “how much does a home loan valuation cost in Mumbai” may read the overview and click the source that explained it best. Getting there is a form of answer engine optimisation — see [what AEO is](/learn/what-is-aeo) for the bigger picture.",
      ],
    },
    {
      id: "official-guidance",
      heading: "What does Google say you need to appear in AI Overviews?",
      paragraphs: [
        "Google’s Search Central guide “AI features and your website” is direct: there are no additional requirements to appear in AI Overviews or AI Mode, and no special optimisation is needed. The same SEO best practices that help a page in normal Search apply.",
        "The one technical rule: to be eligible as a supporting link, a page must be indexed and eligible to be shown in Google Search with a snippet. Google also says there is no special AI text file or new markup you need to add. So anyone selling a secret “AI Overview tag” is selling something Google says does not exist.",
      ],
      table: {
        head: ["What Google asks for", "What it means for your site"],
        rows: [
          ["Page is indexed", "It appears when you search “site:yourdomain.in/page” and in Search Console’s indexing report"],
          ["Eligible for a snippet", "No nosnippet tag, no tiny max-snippet limit on the content you want quoted"],
          ["Googlebot can crawl it", "robots.txt does not block the page, and it returns a normal 200 status"],
          ["Text is in the page", "Important content is real text, not only inside images"],
          ["Helpful, people-first content", "Written for customers, with first-hand detail, not mass-produced filler"],
          ["Structured data matches the page", "Schema only describes what visitors can actually see"],
        ],
      },
    },
    {
      id: "eligibility",
      heading: "Is your page eligible to be shown in an AI Overview?",
      paragraphs: [
        "Most small-business sites that never appear have a basic eligibility problem, not a content problem. Work through this list first.",
      ],
      steps: [
        "Check the page is indexed in Google Search Console (URL Inspection tool).",
        "Make sure there is no “noindex” in the page’s robots meta tag or HTTP header.",
        "Check robots.txt does not block Googlebot from the page or its CSS and JavaScript.",
        "Remove nosnippet or data-nosnippet from text you want Google to quote, and avoid a very low max-snippet value.",
        "Confirm the page shows real text without needing a login or a click to reveal it.",
        "Run the [free website check](/free-check): it reads your homepage and up to 4 main pages and flags pages hidden from Google, missing headings and weak answers, scored as SEO, AEO, GEO and Brand.",
      ],
      bullets: [
        "Google-Extended is a separate control for Gemini model training and Gemini app grounding. Google says it does not affect Google Search, so it does not decide AI Overview eligibility. More on these tokens in [robots.txt for AI crawlers](/learn/robots-txt-for-ai-crawlers).",
      ],
    },
    {
      id: "answer-first",
      heading: "How do you write passages AI Overviews can use?",
      paragraphs: [
        "AI Overviews answer a question, then link to pages that support each part of the answer. Pages that state a clear answer near a matching heading give Google an easy passage to rely on. The habit is simple: put the question as a heading, answer it in the first 40–60 words, then add detail.",
      ],
      table: {
        head: ["Weak passage", "Answer-first passage (example)"],
        rows: [
          [
            "“We are a leading clinic offering world-class dental care with years of experience.”",
            "“A single tooth root canal at our Andheri clinic costs ₹6,000–₹9,000, plus ₹8,000–₹15,000 for a crown. Most treatments take two visits.”",
          ],
          [
            "“Contact us for the best packages.”",
            "“Our 3-night Coorg package starts at ₹14,500 per person and includes homestay, breakfast and a coffee estate walk.”",
          ],
        ],
      },
      bullets: [
        "One idea per paragraph, so a single paragraph can support a single point.",
        "Use lists for steps and tables for prices or comparisons.",
        "Answer follow-up questions on the same page — “how long”, “how much”, “which is better” — because AI Overviews often cover several in one summary.",
        "Show who is answering and when: business name, contact details and an updated date.",
      ],
    },
    {
      id: "structured-data",
      heading: "Does structured data help you appear in AI Overviews?",
      paragraphs: [
        "Structured data (info for Google and AI) is not a requirement for AI Overviews, and Google does not offer an AI Overview schema type. It still helps Google understand what a page is about — a LocalBusiness with its address and hours, an Organization with its official profiles, a Product with its price.",
        "Google’s rule is that structured data must match the visible content of the page. Marking up reviews or FAQs that visitors can’t see breaks its guidelines. Check what your pages already carry with the free [schema checker](/tools/schema-checker), and fix errors before adding anything new.",
      ],
    },
    {
      id: "helpful-content",
      heading: "What kind of content does Google prefer for AI features?",
      paragraphs: [
        "Google points site owners to its guidance on helpful, reliable, people-first content. In plain words: write for your customers first, show real experience, and give information they can’t get from a generic page.",
      ],
      bullets: [
        "First-hand detail: photos of your own work, real prices, local specifics such as areas you serve in Hyderabad or Kochi.",
        "Clear authorship and business identity: an About page and consistent name, address and phone across the web.",
        "Accurate, up-to-date facts — review pages at least every few months.",
        "No mass-produced pages that swap only the city name; Google’s spam policies cover scaled content made mainly to rank.",
        "Solid basics from the [website SEO audit checklist](/learn/website-seo-audit-checklist): titles, headings, speed and mobile layout.",
      ],
    },
    {
      id: "tracking",
      heading: "How do you track whether you appear in AI Overviews?",
      paragraphs: [
        "Google includes traffic from AI features in the normal Performance report in Search Console, under the “Web” search type. It is not shown as a separate line, so look for changes in clicks and impressions on the pages and questions you have improved.",
        "AI Overviews also vary by query and location, so check your own target questions by hand from time to time. To see how Google’s AI features compare with ChatGPT and other assistants, read [SEO vs AEO vs GEO](/learn/seo-vs-aeo-vs-geo).",
      ],
    },
  ],
  faqs: [
    { q: "Do I need special schema to appear in Google AI Overviews?", a: "No. Google says there is no special markup or file needed. Structured data can help Google understand your page, but it must match what visitors see." },
    { q: "Can I pay to appear in AI Overviews?", a: "Not in the organic summary or its supporting links. Those come from Google’s normal index. Ads are a separate, clearly labelled product." },
    { q: "Why is my page ranking on page one but not in the AI Overview?", a: "AI Overviews pick passages that support specific parts of the answer. A page can rank well but still lack a clear, quotable answer to that exact question." },
    { q: "How do I stop Google using my content in AI Overviews?", a: "Use nosnippet, data-nosnippet or max-snippet controls. Be aware these also limit your normal search snippets. Blocking Google-Extended does not affect AI Overviews." },
    { q: "Are AI Overviews available in India?", a: "Yes. Google expanded AI Overviews to India in August 2024." },
  ],
  related: ["what-is-aeo", "website-seo-audit-checklist", "seo-vs-aeo-vs-geo"],
  cta: { label: "Check if Google can quote you", href: "/free-check" },
  sources: [
    { label: "Google Search Central: AI features and your website", url: "https://developers.google.com/search/docs/appearance/ai-features" },
    { label: "Google Search Central: creating helpful, reliable, people-first content", url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content" },
    { label: "Google Search Central: meta descriptions and snippets", url: "https://developers.google.com/search/docs/appearance/snippet" },
    { label: "Google Search Central: introduction to structured data", url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
    { label: "Google Search Central: spam policies", url: "https://developers.google.com/search/docs/essentials/spam-policies" },
  ],
};
