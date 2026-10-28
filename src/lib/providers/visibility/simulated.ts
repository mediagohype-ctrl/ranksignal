// Deterministic demo provider. Output is FABRICATED and must always be labelled "Simulated demo data".
// Seeded by a hash of the prompt text so the same prompt always yields the same answer.
import type { ProviderAnswer, VisibilityProvider, VisibilityQuery } from "@/lib/types";

export const SIMULATED_LABEL = "Simulated demo data";
export const SIMULATED_LIMITATIONS = "Fabricated demo answer for product walkthroughs. Not a real AI platform response.";

export interface SimulatedContext {
  brandNames: string[];
  competitors: { name: string; domain?: string }[];
  websiteDomain: string;
}

export function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GENERIC_SOURCES = ["en.wikipedia.org", "www.reddit.com", "www.g2.com", "www.forbes.com", "medium.com", "www.quora.com"];
const OPENERS = [
  "Here are some options worth looking at",
  "Several providers are commonly mentioned for this",
  "Based on publicly available information, these stand out",
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createSimulatedProvider(ctx: SimulatedContext): VisibilityProvider {
  const brand = ctx.brandNames[0] ?? "Your brand";
  return {
    id: "simulated",
    label: SIMULATED_LABEL,
    simulated: true,
    isConfigured: () => process.env.ALLOW_SIMULATED_PROVIDER !== "false",
    async run(query: VisibilityQuery): Promise<ProviderAnswer> {
      const rand = mulberry32(hashString(`${query.text.trim().toLowerCase()}|${query.locale}`));
      const entities: { name: string; domain?: string; isBrand: boolean }[] = [];
      const includeBrand = rand() < 0.45;
      const brandRank = rand();
      for (const c of ctx.competitors) if (rand() < 0.6) entities.push({ name: c.name, domain: c.domain, isBrand: false });
      if (includeBrand) {
        const pos = Math.min(entities.length, Math.floor(brandRank * (entities.length + 1)));
        entities.splice(pos, 0, { name: brand, domain: ctx.websiteDomain, isBrand: true });
      }
      if (entities.length === 0) entities.push({ name: "a well-reviewed local provider", isBrand: false });

      const lines = [`${OPENERS[Math.floor(rand() * OPENERS.length)]} for "${query.text}":`, ""];
      entities.forEach((e, i) => {
        const tail = rand() < 0.5 ? "is often recommended for its range and support." : "is a popular choice with good reviews.";
        lines.push(`${i + 1}. **${e.name}** ${tail}`);
      });
      lines.push("", "Compare pricing, reviews and support before deciding.");

      const citations: { url: string; title?: string }[] = [];
      for (const e of entities) {
        if (e.domain && rand() < (e.isBrand ? 0.5 : 0.4)) citations.push({ url: `https://${e.domain}/`, title: e.name });
      }
      const nGeneric = Math.floor(rand() * 3);
      for (let i = 0; i < nGeneric; i++) {
        const d = GENERIC_SOURCES[Math.floor(rand() * GENERIC_SOURCES.length)];
        const url = `https://${d}/${slug(query.text).slice(0, 40)}`;
        if (!citations.some((c) => c.url === url)) citations.push({ url });
      }
      return {
        provider: "simulated",
        platformLabel: SIMULATED_LABEL,
        model: "simulated-v1",
        answerText: lines.join("\n"),
        citations,
        costMicros: 0,
        simulated: true,
        limitations: SIMULATED_LIMITATIONS,
      };
    },
  };
}
