// Editor data shape + the blank post. Plain module (NOT "use client"): server pages call emptyPost() to build the
// initial form, and Next.js forbids calling functions exported from a client module on the server.

export interface EditorPost {
  id?: string;
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  answer: string;
  body: string;
  keyPoints: string[];
  faqs: { q: string; a: string }[];
  keywords: string[];
  category: string;
  coverImageUrl: string;
  authorName: string;
  noindex: boolean;
  status: string;
  /** Set once a post has ever been published: its address is then fixed (changing it would break links). */
  slugLocked?: boolean;
}

const STARTER_BODY = `## What is [topic]?

Explain the idea in plain words. Link to a related page like [our free website check](/free-check).

## Why does it matter?

Give 2–3 specific facts or numbers, and link the source you used.

## How do you do it? (step by step)

1. First step
2. Second step
3. Third step

## [Topic] vs [alternative]

| | Option A | Option B |
|---|---|---|
| Best for | … | … |
| Cost | … | … |
`;

export const emptyPost = (authorName: string): EditorPost => ({
  slug: "",
  title: "",
  metaTitle: "",
  description: "",
  answer: "",
  body: STARTER_BODY,
  keyPoints: ["", "", ""],
  faqs: [
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ],
  keywords: [],
  category: "SEO",
  coverImageUrl: "",
  authorName,
  noindex: false,
  status: "draft",
});
