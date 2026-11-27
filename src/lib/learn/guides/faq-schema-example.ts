import type { Article } from "@/lib/learn/articles";

const SERVICE_EXAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you offer same-day AC repair in Pune?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Book before 1 pm and a technician visits the same day anywhere in Pune city. Bookings after 1 pm are visited the next morning."
      }
    },
    {
      "@type": "Question",
      "name": "How much does an AC service cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A standard split AC service costs ₹599. Gas refilling and spare parts are quoted on site before any work starts."
      }
    }
  ]
}
</script>`;

const PRODUCT_EXAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is this cotton kurta machine washable?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Wash it in cold water on a gentle cycle and dry it in the shade. Do not bleach."
      }
    },
    {
      "@type": "Question",
      "name": "What is your return policy for this product?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can return it unused, with tags, within 7 days of delivery for a full refund."
      }
    }
  ]
}
</script>`;

const BLOG_EXAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is llms.txt?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "llms.txt is a short text file at the root of a website that tells AI tools what the site is about and which pages to read first."
      }
    }
  ]
}
</script>`;

export const article: Article = {
  slug: "faq-schema-example",
  title: "FAQ schema example: copy-paste JSON-LD code for service pages, products and blogs",
  metaTitle: "FAQ Schema Example: Copy-Paste JSON-LD Code",
  description:
    "Working FAQ schema examples in JSON-LD for service pages, products and blogs. Copy the code, swap your questions, and test it free.",
  keywords: ["faq schema example", "faq schema json-ld example", "FAQPage schema example", "faq structured data example"],
  published: "2026-11-27",
  updated: "2026-11-27",
  answer:
    "A FAQ schema example is a block of JSON-LD code with the type FAQPage. Inside “mainEntity” you list each question as a Question with a “name”, and its answer as an acceptedAnswer with a “text”. You paste the block into the page’s HTML, and the same questions and answers must also be visible on that page.",
  keyPoints: [
    "FAQ schema uses the schema.org type FAQPage, written as JSON-LD inside a <script type=\"application/ld+json\"> tag.",
    "Each item needs three things: the Question, its name (the question text) and an acceptedAnswer with the answer text.",
    "The questions and answers in the code must match text that visitors can read on the same page.",
    "Since August 2023 Google shows FAQ rich results mainly for well-known government and health websites, but the code still labels your answers clearly for search engines and AI assistants.",
    "Test the code with Google’s Rich Results Test or our free schema checker before you publish it.",
  ],
  sections: [
    {
      id: "basic",
      heading: "What does a basic FAQ schema example look like?",
      paragraphs: [
        "Below is a complete FAQ schema example for a service page, here an AC repair business. It has two questions. Copy it, replace the questions and answers with your own, and keep the structure exactly as it is: the commas, brackets and quote marks all matter.",
      ],
      code: SERVICE_EXAMPLE,
    },
    {
      id: "fields",
      heading: "What does each part of the code mean?",
      paragraphs: ["Only a few fields are needed. Everything else in the example is the wrapper that tells search engines what kind of data this is."],
      table: {
        head: ["Field", "What it holds", "Required?"],
        rows: [
          ["@context", "Always “https://schema.org”", "Yes"],
          ["@type: FAQPage", "Says the page is a list of questions and answers", "Yes"],
          ["mainEntity", "The list of questions, in square brackets", "Yes"],
          ["Question → name", "The full question, word for word as it appears on the page", "Yes"],
          ["acceptedAnswer → text", "The full answer, word for word as it appears on the page", "Yes"],
        ],
      },
    },
    {
      id: "product",
      heading: "FAQ schema example for a product page",
      paragraphs: [
        "On a product page, use questions about that product: care, sizing, delivery and returns. Don’t copy the same FAQ block onto every product; each page should answer questions about its own item.",
      ],
      code: PRODUCT_EXAMPLE,
    },
    {
      id: "blog",
      heading: "FAQ schema example for a blog post",
      paragraphs: [
        "A blog post or guide can carry FAQ schema for the FAQ section at its end. One question is fine. Keep the answers short and factual, the way you would answer a customer.",
      ],
      code: BLOG_EXAMPLE,
    },
    {
      id: "add",
      heading: "How do you add FAQ schema to your website?",
      paragraphs: [
        "Put the code anywhere in the page’s HTML, usually just before the closing </body> tag or inside the <head>. The page must also show the same questions and answers as normal text.",
      ],
      steps: [
        "Write the questions and answers on the page first, as visible text.",
        "Build the code: copy an example above, or type your questions into our free [FAQ schema generator](/tools/faq-schema-generator) and copy what it makes.",
        "WordPress: add a “Custom HTML” block on that page and paste the code. Shopify: paste it into the page or product template. Next.js or React: render it in a <script type=\"application/ld+json\"> tag.",
        "Test the page with our free [schema checker](/tools/schema-checker) or Google’s Rich Results Test, and fix any error it lists.",
      ],
      bullets: [
        "Need question ideas first? The [FAQ question generator](/tools/faq-generator) drafts the questions customers ask about a page.",
      ],
    },
    {
      id: "mistakes",
      heading: "What are the most common FAQ schema mistakes?",
      paragraphs: ["Most broken FAQ code comes down to a handful of mistakes:"],
      bullets: [
        "Questions in the code that don’t appear on the page. Google’s guidelines say the markup must match visible content.",
        "Curly quotes (“ ”) instead of straight quotes (\") around field names, often from copying through a word processor. JSON needs straight quotes.",
        "A missing or extra comma between questions, which makes the whole block invalid.",
        "The same FAQ block on every page of the site, or FAQ code used for adverts rather than real questions.",
        "Answers that are out of date after prices, hours or service areas change.",
      ],
    },
  ],
  faqs: [
    { q: "Where do I put FAQ schema code?", a: "Anywhere in the page’s HTML, usually in the <head> or just before the closing </body> tag. On WordPress, a Custom HTML block on the page works. The same questions and answers must also be visible on that page." },
    { q: "Does FAQ schema still work in 2026?", a: "The code is still valid and still read by search engines and AI assistants. Since August 2023, Google shows the drop-down FAQ rich result mainly for well-known government and health websites, so most sites should not expect that feature." },
    { q: "How many questions should a FAQ schema have?", a: "As many as the page really answers, usually between 3 and 10. One is allowed. Quality matters more than number." },
    { q: "Is FAQ schema the same as FAQPage schema?", a: "Yes. “FAQ schema” is the everyday name for the schema.org type FAQPage, usually written in JSON-LD." },
  ],
  related: ["llms-txt-guide", "google-ai-overview", "improve-ai-search-visibility"],
  cta: { label: "Make your FAQ schema free", href: "/tools/faq-schema-generator" },
  sources: [
    { label: "Google Search Central: FAQ (FAQPage) structured data", url: "https://developers.google.com/search/docs/appearance/structured-data/faqpage" },
    { label: "Google Search Central blog: changes to HowTo and FAQ rich results (August 2023)", url: "https://developers.google.com/search/blog/2023/08/howto-faq-changes" },
    { label: "schema.org: FAQPage", url: "https://schema.org/FAQPage" },
  ],
};
