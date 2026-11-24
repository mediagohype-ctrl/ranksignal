import type { Article } from "@/lib/learn/articles";

export const article: Article = {
  slug: "robots-txt-for-ai-crawlers",
  title: "robots.txt for AI crawlers: allow or block GPTBot, ClaudeBot and more",
  metaTitle: "robots.txt for AI Crawlers: GPTBot & More",
  description:
    "robots.txt for AI crawlers explained: every AI bot user agent, what GPTBot does, and copy-paste rules to block AI training but stay in AI answers.",
  keywords: ["robots.txt for AI crawlers", "robots txt ai block", "gptbot robots.txt", "gptbot user agent"],
  published: "2026-11-24",
  updated: "2026-11-24",
  answer:
    "robots.txt is a plain text file at yoursite.com/robots.txt that tells robots which pages they may read. AI companies use separate robots (user agents) for search answers and for model training, so you can block training — for example “User-agent: GPTBot” then “Disallow: /” — while still letting OAI-SearchBot and PerplexityBot show your site in AI answers.",
  keyPoints: [
    "Each AI company runs more than one robot: one for live search answers, often one for user requests, and one for collecting training data.",
    "GPTBot collects data to train OpenAI’s models; OAI-SearchBot is the one that lets ChatGPT search show and link your pages.",
    "Blocking a training robot is a fair business choice and does not by itself remove you from AI search answers.",
    "Blocking a search robot (OAI-SearchBot, PerplexityBot, Claude-SearchBot) means that assistant can’t read your pages to answer customers.",
    "robots.txt is a polite request, not a lock. Firewalls and security plugins can block AI robots even when robots.txt allows them.",
  ],
  sections: [
    {
      id: "what-is-it",
      heading: "What does robots.txt do for AI crawlers?",
      paragraphs: [
        "Your robots.txt file (your site’s robot rules file) sits at the root of your website, for example www.example.in/robots.txt. Every well-behaved robot reads it before visiting your pages. Each block of rules starts with a “User-agent:” line naming the robot, followed by “Allow:” or “Disallow:” lines for the paths it may or may not read. The format is an internet standard, RFC 9309.",
        "AI assistants such as ChatGPT, Claude, Perplexity and Gemini rely on robots (crawlers) to read the web. If your robots.txt blocks the wrong one, an assistant may not be able to read or link your pages when a customer asks about your type of business. If you have no robots.txt at all, every robot is allowed by default.",
        "The fastest way to see what your current file says to each AI robot is our free [AI crawler checker](/tools/ai-crawler-checker). Type your website address and it shows, robot by robot, which ones are allowed and which are blocked.",
      ],
    },
    {
      id: "user-agents",
      heading: "Which AI bot user agents should you know?",
      paragraphs: [
        "These are the names (user agent tokens) you write after “User-agent:”. The last column is the one that matters for your decision: robots marked “Search / answers” or “User request” bring your pages into AI answers; robots marked “Training” collect pages to train AI models.",
      ],
      table: {
        head: ["User agent token", "Company", "What it does", "Type"],
        rows: [
          ["OAI-SearchBot", "OpenAI", "Finds and links pages in ChatGPT search", "Search / answers"],
          ["ChatGPT-User", "OpenAI", "Opens a page when a ChatGPT user asks it to", "User request"],
          ["GPTBot", "OpenAI", "Collects pages to train OpenAI models", "Training"],
          ["PerplexityBot", "Perplexity", "Finds and links pages in Perplexity answers", "Search / answers"],
          ["Perplexity-User", "Perplexity", "Opens a page when a Perplexity user asks", "User request"],
          ["Claude-SearchBot", "Anthropic", "Finds pages for Claude’s search answers", "Search / answers"],
          ["Claude-User", "Anthropic", "Opens a page when a Claude user asks", "User request"],
          ["ClaudeBot", "Anthropic", "Collects pages to train Anthropic models", "Training"],
          ["Google-Extended", "Google", "Not a separate robot: a token that controls Gemini training and grounding. Does not affect Google Search", "Training"],
          ["Applebot-Extended", "Apple", "A token that controls Apple AI training (Applebot itself is Apple’s search robot)", "Training"],
          ["CCBot", "Common Crawl", "Builds a public web archive that many AI models are trained on", "Training"],
          ["Bingbot", "Microsoft", "Bing search, which also feeds Copilot answers", "Search / answers"],
          ["DuckAssistBot", "DuckDuckGo", "Reads pages for DuckDuckGo’s AI answers", "Search / answers"],
          ["MistralAI-User", "Mistral", "Opens a page when a Le Chat user asks", "User request"],
          ["meta-externalagent", "Meta", "Collects pages for Meta’s AI models and products", "Training"],
          ["Amazonbot", "Amazon", "Reads pages for Amazon services such as Alexa answers", "Search / answers"],
        ],
      },
      bullets: [
        "Names are not case-sensitive, but copy them exactly as shown to avoid typos.",
        "Companies add and rename robots from time to time. Check the official pages (OpenAI’s “Overview of OpenAI crawlers” and Google’s “common crawlers” list) before you rely on a rule.",
      ],
    },
    {
      id: "training-vs-answers",
      heading: "What is the difference between blocking training and blocking answers?",
      paragraphs: [
        "Blocking a training robot (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended) asks that company not to use your pages to build future AI models. It does not take you out of today’s AI search answers, because those use different robots. Many businesses choose this to protect original writing, photos or paid content — and it is a perfectly fair choice.",
        "Blocking a search or answer robot (OAI-SearchBot, PerplexityBot, Claude-SearchBot) is a different decision. That assistant can no longer read your pages when it searches the web for a customer, so it can’t quote or link you. For a small business that wants enquiries, this usually works against you.",
        "Google is a special case. AI Overviews and AI Mode in Google Search use the normal Googlebot, so blocking Google-Extended does not remove you from them. Blocking Google-Extended can, however, reduce how your pages are used for grounding answers in the Gemini app. If you want to understand how AI assistants pick businesses to name, read [what GEO is](/learn/what-is-geo).",
      ],
    },
    {
      id: "allow-all",
      heading: "How do you allow all AI search bots? (copy-paste)",
      paragraphs: [
        "If you want every AI assistant to be able to read your public pages, the simplest file is below. Each item is one line of your robots.txt file. Replace example.in with your own domain.",
      ],
      steps: [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin/",
        "Sitemap: https://www.example.in/sitemap.xml",
      ],
      bullets: [
        "The “*” group applies to every robot that has no group of its own, including all AI robots.",
        "Keep private areas such as /admin/ or /cart/ disallowed for everyone.",
        "If a robot has its own named group, it ignores the “*” group completely. So if your file already names GPTBot or PerplexityBot with “Disallow: /”, delete those lines too.",
      ],
    },
    {
      id: "block-training",
      heading: "How do you block AI training but stay in AI answers? (copy-paste)",
      paragraphs: [
        "This version asks the main training robots to stay out, while search and answer robots (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot and Googlebot) still follow the open “*” group. Leave a blank line between groups.",
      ],
      steps: [
        "User-agent: GPTBot",
        "Disallow: /",
        "User-agent: ClaudeBot",
        "Disallow: /",
        "User-agent: CCBot",
        "Disallow: /",
        "User-agent: Google-Extended",
        "Disallow: /",
        "User-agent: Applebot-Extended",
        "Disallow: /",
        "User-agent: meta-externalagent",
        "Disallow: /",
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://www.example.in/sitemap.xml",
      ],
      bullets: [
        "Remove the Google-Extended lines if you want Gemini app answers to be able to use your pages for grounding.",
        "Paste the finished file into our [robots.txt tester](/tools/robots-txt-tester) and test a URL against GPTBot and OAI-SearchBot to confirm one is blocked and the other is allowed.",
      ],
    },
    {
      id: "block-one",
      heading: "How do you block just one AI bot, or one folder?",
      paragraphs: [
        "To block a single robot from the whole site, give it its own group. For example, to keep Common Crawl out while every other robot stays allowed:",
      ],
      steps: [
        "User-agent: CCBot",
        "Disallow: /",
        "User-agent: *",
        "Allow: /",
      ],
      bullets: [
        "To block GPTBot from one folder only — say, a paid course area — use “User-agent: GPTBot” followed by “Disallow: /courses/”.",
        "To list several robots under the same rules, write one “User-agent:” line for each, one after another, then the shared “Disallow:” lines.",
        "Never write “User-agent: *” followed by “Disallow: /” unless you want your whole site hidden from Google as well as AI.",
      ],
    },
    {
      id: "still-blocked",
      heading: "Why might AI bots still be blocked when robots.txt allows them?",
      paragraphs: [
        "robots.txt only works for robots that choose to follow it, and it is not the only gate. Many sites block AI robots somewhere else without the owner knowing.",
      ],
      bullets: [
        "CDN and firewall settings: Cloudflare and other services offer “block AI bots” switches that turn away AI robots before they reach robots.txt.",
        "WordPress security plugins: some block unknown or AI user agents by default.",
        "Hosting “bot protection” on cheaper Indian and global shared hosting plans, which can return errors to robots.",
        "A login wall, or content that only appears after JavaScript runs — many AI robots read the raw HTML only.",
      ],
    },
    {
      id: "check",
      heading: "How do you check your robots.txt for AI crawlers?",
      paragraphs: [
        "Changes are not instant: robots fetch robots.txt from time to time, so allow a day or more before expecting a difference.",
      ],
      steps: [
        "Run the free [AI crawler checker](/tools/ai-crawler-checker) on your domain to see each AI robot’s status in one table.",
        "Edit robots.txt (in WordPress, Shopify or your hosting file manager), then test the new rules in the [robots.txt tester](/tools/robots-txt-tester).",
        "Check your CDN, firewall and security plugin settings for AI-bot blocking.",
        "Add an AI guide file so assistants can find your key pages quickly — see our [llms.txt guide](/learn/llms-txt-guide).",
        "Run the [free website check](/free-check): it reads your homepage and up to 4 main pages, checks AI crawler access in robots.txt, and scores your SEO, AEO, GEO and Brand.",
        "Then learn what else affects AI answers in [how to rank on ChatGPT](/learn/how-to-rank-on-chatgpt).",
      ],
    },
  ],
  faqs: [
    { q: "What is the GPTBot user agent?", a: "GPTBot is the robot OpenAI uses to collect public web pages that may be used to train its AI models. You control it in robots.txt with the line “User-agent: GPTBot”. It is separate from OAI-SearchBot, which powers ChatGPT search." },
    { q: "Does blocking GPTBot remove my site from ChatGPT?", a: "No. Blocking GPTBot only opts you out of training. Whether ChatGPT search can show and link your pages depends on OAI-SearchBot, which you can keep allowed." },
    { q: "Does blocking Google-Extended remove me from AI Overviews?", a: "No. Google says Google-Extended does not affect Google Search, and AI Overviews are part of Search. It controls Gemini model training and grounding in the Gemini app." },
    { q: "Do all AI bots obey robots.txt?", a: "The major companies say their robots follow it, but robots.txt is a request, not a lock. To truly stop a robot you need a firewall or server rule." },
    { q: "Where is my robots.txt file?", a: "It must be at the root of your domain, for example www.example.in/robots.txt. A robots.txt file inside a folder is ignored." },
  ],
  related: ["llms-txt-guide", "what-is-geo", "how-to-rank-on-chatgpt"],
  cta: { label: "Check AI crawler access free", href: "/tools/ai-crawler-checker" },
  sources: [
    { label: "OpenAI: Overview of OpenAI crawlers", url: "https://platform.openai.com/docs/bots" },
    { label: "Google Search Central: Google’s common crawlers (incl. Google-Extended)", url: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers" },
    { label: "Google Search Central: introduction to robots.txt", url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro" },
    { label: "IETF RFC 9309: Robots Exclusion Protocol", url: "https://datatracker.ietf.org/doc/html/rfc9309" },
  ],
};
