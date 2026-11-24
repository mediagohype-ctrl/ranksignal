// Authors of MyWebRank's guides and product content. Used by the About page, /author/<slug> and article bylines
// (schema.org Person). Facts only: nothing here may be invented. The owner adds the photo and profile links.
//
// TODO(owner): add Shubhankar's real bio details (only what is true and public), a photo path under /public
// (e.g. "/authors/shubhankar-gupta.jpg") and his profile links (LinkedIn, X) in sameAs.

export interface Author {
  slug: string;
  name: string;
  /** One short role line, shown under the name. */
  role: string;
  /** Short factual paragraphs. Never empty. */
  bio: string[];
  /** Public path to a square photo, or null to show an initials avatar. */
  photo: string | null;
  /** Official profile URLs (https), for schema.org Person.sameAs. */
  sameAs: string[];
  /** Topics for schema.org Person.knowsAbout. */
  knowsAbout: string[];
}

export const AUTHORS: Record<string, Author> = {
  "shubhankar-gupta": {
    slug: "shubhankar-gupta",
    name: "Shubhankar Gupta",
    role: "Leads MyWebRank's SEO, AEO and GEO guides and product content",
    bio: [
      "Shubhankar Gupta writes and edits MyWebRank's guides on SEO, AEO and GEO.",
      "His focus is helping small businesses in India get found on Google and on AI assistants like ChatGPT.",
      "He is part of the team at Go Hype Media in New Delhi, the company that runs MyWebRank.",
    ],
    photo: null,
    sameAs: [],
    knowsAbout: [
      "Search engine optimization",
      "Answer engine optimization",
      "Generative engine optimization",
      "AI search visibility",
      "Local SEO",
    ],
  },
};

export const DEFAULT_AUTHOR: Author = AUTHORS["shubhankar-gupta"];

/** Site path of an author's page, e.g. "/author/shubhankar-gupta". */
export function authorUrl(slug: string): string {
  return `/author/${slug}`;
}

/** Initials for the avatar fallback, e.g. "Shubhankar Gupta" -> "SG". */
export function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}
