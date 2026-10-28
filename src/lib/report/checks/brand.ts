// Brand checks: does your website present one clear, trustworthy business — and do AI tools know it?
import { mentionsBrand } from "@/lib/crawler/extract";
import {
  findHome, hostOf, makeCheck, notMeasured, okPages, pct, plural, urlOf, v2Pages, NEEDS_RESCAN,
  type CheckContext, type EvaluatedCheck,
} from "@/lib/report/inputs";

const P = "brand" as const;
const NOT_MEASURED_AI = "AI answers have not been measured yet — run an AI visibility check.";

export function brandChecks(ctx: CheckContext): EvaluatedCheck[] {
  const ok = okPages(ctx.pages);
  const out: EvaluatedCheck[] = [];
  const v2 = v2Pages(ctx.pages);
  const home = findHome(ctx);
  const homeUrl = home ? urlOf(home) : ctx.websiteUrl;
  const names = ctx.brandNames;

  if (ok.length > 0) {
    // Brand name consistency.
    if (names.length === 0) {
      out.push(notMeasured(P, "brand.name_consistency", "Brand name used consistently", 2, "No brand name is set for this project."));
    } else {
      const inTitle = ok.filter((p) => mentionsBrand(p.extracted!.title, names));
      const homeTitle = !!home && mentionsBrand(home.extracted!.title, names);
      const homeH1 = !!home && (home.extracted!.h1.some((h) => mentionsBrand(h, names)) || mentionsBrand(home.extracted!.openGraph?.siteName, names));
      const homeBody = !!home && (home.extracted!.brandMentions ? home.extracted!.brandMentions.bodyCount > 0 : mentionsBrand(home.extracted!.textSample, names));
      const titleShare = inTitle.length / ok.length;
      const score = (homeTitle ? 35 : 0) + (homeH1 ? 15 : 0) + (homeBody ? 10 : 0) + 40 * Math.min(1, titleShare / 0.7);
      out.push(makeCheck(P, "brand.name_consistency", "Brand name used consistently", 2, {
        score,
        detail: `"${names[0]}" appears in ${inTitle.length} of ${ok.length} page titles; homepage title: ${homeTitle ? "yes" : "no"}, homepage main heading or site name: ${homeH1 ? "yes" : "no"}.`,
        affected: ok.filter((p) => !inTitle.includes(p)).map(urlOf),
        facts: { inTitle: inTitle.length, total: ok.length, homeTitle, homeH1 },
      }));
    }

    if (v2.length === 0) {
      for (const [id, label, w] of [
        ["brand.organization_schema", "Business details markup + logo", 2],
        ["brand.about_page", "About page", 1.5],
        ["brand.contact_info", "Contact details (name, address, phone)", 2],
        ["brand.privacy_policy", "Privacy policy", 1],
        ["brand.social_profiles", "Links to your social profiles", 1],
      ] as const) out.push(notMeasured(P, id, label, w, NEEDS_RESCAN));
    } else {
      // Organization schema + logo.
      const org = home?.extracted?.organization ?? v2.map((p) => p.extracted!.organization).find((o) => !!o) ?? null;
      const nameMatches = !!org?.name && (names.length === 0 || mentionsBrand(org.name, names));
      out.push(makeCheck(P, "brand.organization_schema", "Business details markup + logo", 2, {
        score: org ? 60 + (org.logo ? 25 : 0) + (nameMatches ? 15 : 0) : 0,
        detail: org
          ? `Business markup found${org.name ? ` for "${org.name.slice(0, 60)}"` : ""}; logo: ${org.logo ? "yes" : "missing"}${names.length && org.name && !nameMatches ? "; the name doesn't match your brand name" : ""}.`
          : "No Organization or LocalBusiness markup was found on your homepage or other pages.",
        affected: org && org.logo && nameMatches ? [] : [homeUrl],
        facts: { hasOrg: !!org, logo: !!org?.logo, nameMatches },
      }));

      // About page.
      const aboutLink = v2.map((p) => p.extracted!.pageLinks?.about).find((u) => !!u) ?? null;
      const aboutCrawled = ok.find((p) => /\/(about|about-us|who-we-are|our-story|company)(\/|\.|-|$)/i.test(urlOf(p)));
      const hasAbout = !!(aboutLink || aboutCrawled);
      out.push(makeCheck(P, "brand.about_page", "About page", 1.5, {
        score: hasAbout ? 100 : 15,
        detail: hasAbout ? `You have an About page (${aboutCrawled ? urlOf(aboutCrawled) : aboutLink}).` : "We couldn't find an About page linked from your site.",
        affected: hasAbout ? [] : [homeUrl],
        facts: { hasAbout },
      }));

      // Contact info / NAP.
      const contactLink = v2.map((p) => p.extracted!.pageLinks?.contact).find((u) => !!u) ?? null;
      const phone = v2.some((p) => p.extracted!.hasPhoneLink || !!p.extracted!.organization?.telephone);
      const email = v2.some((p) => p.extracted!.hasEmailLink || !!p.extracted!.organization?.email);
      const address = v2.some((p) => !!p.extracted!.organization?.hasAddress);
      const score = (contactLink ? 40 : 0) + (phone || email ? 35 : 0) + (address ? 25 : 0);
      const missing = [!contactLink && "a contact page", !(phone || email) && "a clickable phone number or email", !address && "a business address in your markup"].filter(Boolean);
      out.push(makeCheck(P, "brand.contact_info", "Contact details (name, address, phone)", 2, {
        score,
        detail: missing.length ? `Missing: ${missing.join(", ")}.` : "Contact page, phone/email and business address are all present.",
        affected: missing.length ? [homeUrl] : [],
        facts: { contactPage: !!contactLink, phone, email, address },
      }));

      // Privacy policy.
      const privacy = v2.map((p) => p.extracted!.pageLinks?.privacy).find((u) => !!u) ?? null;
      out.push(makeCheck(P, "brand.privacy_policy", "Privacy policy", 1, {
        score: privacy ? 100 : 20,
        detail: privacy ? "A privacy policy is linked from your site." : "No privacy policy link was found.",
        affected: privacy ? [] : [homeUrl],
        facts: { privacy: !!privacy },
      }));

      // Social profiles linked from the site (or in schema sameAs).
      const socialHosts = new Set<string>();
      for (const p of v2) for (const u of [...(p.extracted!.socialLinks ?? []), ...(p.extracted!.organization?.sameAs ?? [])]) {
        const h = hostOf(u);
        if (h && !/wikipedia|wikidata/.test(h)) socialHosts.add(h.replace(/^(m|mobile|[a-z]{2})\./, ""));
      }
      const n = socialHosts.size;
      out.push(makeCheck(P, "brand.social_profiles", "Links to your social profiles", 1, {
        score: n >= 2 ? 100 : n === 1 ? 60 : 10,
        detail: n ? `Your site links to ${plural(n, "social platform")} (${Array.from(socialHosts).slice(0, 5).join(", ")}).` : "Your site doesn't link to any social media profiles.",
        affected: n ? [] : [homeUrl],
        facts: { platforms: n },
      }));
    }
  }

  // AI recommendation vs competitors.
  const ai = ctx.ai;
  if (!ai.measured || ai.simulated) {
    out.push(notMeasured(P, "brand.ai_recommendation", "Recommended by AI tools", 2, ai.simulated ? "Only demo (simulated) AI answers exist — they are not used for scoring." : NOT_MEASURED_AI));
  } else {
    const rr = ai.recommendationRate ?? 0;
    const top = ai.topCompetitors[0];
    out.push(makeCheck(P, "brand.ai_recommendation", "Recommended by AI tools", 2, {
      score: Math.min(100, (100 * rr) / 0.4),
      detail: `AI tools recommended you in ${pct(rr)} of ${ai.sampleSize} answers${top ? `; ${top.name} was the most-mentioned competitor (${pct(top.share)} of mentions)` : ""}.`,
      facts: { recommendationRate: rr },
    }));
  }

  // AI brand knowledge (written by the visibility module when available).
  const bk = ai.brandKnowledge ?? [];
  if (bk.length === 0) {
    out.push(notMeasured(P, "brand.ai_knowledge", "What AI tools know about you", 2, "AI brand-knowledge checks haven't been run yet."));
  } else {
    const knows = bk.filter((b) => b.knowsBrand).length;
    const inaccuracies = bk.reduce((a, b) => a + b.inaccuracies.length, 0);
    out.push(makeCheck(P, "brand.ai_knowledge", "What AI tools know about you", 2, {
      score: Math.max(0, (100 * knows) / bk.length - inaccuracies * 10),
      detail: `${knows} of ${bk.length} AI tools recognised your brand; ${plural(inaccuracies, "inaccuracy", "inaccuracies")} found in what they said.`,
      evidence: bk.flatMap((b) => b.inaccuracies.map((i) => `${b.provider}: ${i}`))[0],
      facts: { knows, total: bk.length, inaccuracies },
    }));
  }
  return out;
}
