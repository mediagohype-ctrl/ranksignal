import type { Metadata } from "next";
import { BRAND, WHATSAPP_HELP_MESSAGE, brandWhatsappHref } from "@/lib/brand";
import { DEFAULT_AUTHOR, authorUrl } from "@/lib/authors";
import { GRIEVANCE_OFFICER, LEGAL_ADDRESS, LEGAL_EMAIL } from "@/lib/site";
import { breadcrumbLd, siteUrl, webPageLd } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/marketing/ui";
import { AboutBody, legalSmallPrint, type AboutCopy } from "@/components/marketing/about-ui";
import { CUSTOM_PLAN, DFY_PLAN } from "@/components/marketing/plans";

// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/about");

/** City we work from (the registered office is in New Delhi; the full address shows when BRAND_ADDRESS_* is set). */
const CITY = "New Delhi, India";

/** "+91 84477 88703" from the digits-only BRAND.whatsapp. */
function whatsappDisplay(digits: string): string {
  return digits.length === 12 && digits.startsWith("91") ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

// About page (Full Site Audit, 15 Nov 2026; trust signals, 24 Nov 2026): headline, the proof line and where it comes
// from, a 3-line story, what we do, 3 beliefs, how we work, who writes our guides, company details and one button.
// Facts only: nothing on this page may be invented (no years, clients, awards or reviews).
function aboutCopy(): AboutCopy {
  const { legalName, gstin } = legalSmallPrint();
  return {
    eyebrow: "About us",
    title: "We help businesses get found.",
    proof: BRAND.proof,
    proofSource: `Where this number comes from: it counts businesses served by the team behind ${BRAND.name}, through its agency work at ${legalName}. It is not a count of ${BRAND.name} accounts.`,
    storyTitle: "Why we built it",
    story: [
      "People now ask Google and AI tools like ChatGPT who to buy from.",
      "Most business owners can't tell whether they show up, or what to change.",
      `${BRAND.name} checks your website and shows what to fix, in plain words. If you'd rather not do it yourself, our team in India does it for you.`,
    ],
    whatWeDo: {
      title: `What ${BRAND.name} does`,
      intro: "We check your website the way Google and AI assistants read it. You get four scores, and each one comes with a plain list of what to fix first.",
      // Same lines as PILLAR_EXPLAINER (src/components/app/report/pillars.tsx), kept here so this page does not load app icons.
      items: [
        { name: "SEO · Google Score", body: "How easily Google can find, read and understand your pages." },
        { name: "AEO · Answer Score", body: "How easily Google and AI tools can lift a short, direct answer from your pages." },
        { name: "GEO · AI Score", body: "Whether AI tools like ChatGPT and Gemini can read your site, and how often they name and link to you." },
        { name: "Brand · Trust Score", body: "How clearly your business is described, and whether AI tools get the facts about you right." },
      ],
      outro: [
        "We also ask AI assistants the kind of questions your customers ask, and show you whether your business is named in the answers.",
        `You can make the fixes yourself with our step-by-step guides, or our team can make them for you on ${DFY_PLAN.name}.`,
      ],
    },
    beliefsTitle: "Three things we believe",
    beliefs: [
      { title: "Plain words", body: "Every problem comes with what is wrong and how to fix it, in words a shop owner can follow." },
      { title: "Honest numbers", body: "Nobody controls Google or AI answers, so we never promise a position. We measure, and show you what changed." },
      {
        title: "You stay in charge",
        body: `Nothing changes on your website without your OK. You make the fixes with our steps, or our team makes them on ${DFY_PLAN.name}.`,
      },
    ],
    howWeWork: {
      title: "How we work",
      items: [
        {
          title: "No ranking promises",
          body: "Google decides its own results, and AI tools decide their own answers. We can make your website easier to find and understand, but we never promise a position or a number of mentions.",
        },
        {
          title: "You approve every change",
          body: "We show you each fix before it goes live. Nothing on your website changes until you say yes, and you can always ask why a fix matters.",
        },
        {
          title: "AI answers vary",
          body: "ChatGPT and other AI tools can give a different answer to the same question on a different day. One answer is a snapshot, not a verdict, so we report what we saw and you can check again later.",
        },
        {
          title: "A real person to ask",
          body: "If you get stuck, email us or chat with us on WhatsApp. A person from our team will reply.",
        },
      ],
    },
    team: {
      title: "Who writes our guides",
      intro: `Our guides on SEO, AEO and GEO, and the words you read inside ${BRAND.name}, are led by one person on our team.`,
      author: DEFAULT_AUTHOR,
      href: authorUrl(DEFAULT_AUTHOR.slug),
      linkLabel: `More about ${DEFAULT_AUTHOR.name}`,
    },
    company: {
      title: "Company details",
      intro: `${BRAND.name} is a product of ${legalName}, based in New Delhi. Here is who we are and how to reach us.`,
      rows: [
        { label: "Legal name", value: legalName },
        { label: "GST number", value: gstin ?? "" },
        { label: "City", value: CITY },
        { label: "Registered office", value: LEGAL_ADDRESS },
        { label: "Email", value: LEGAL_EMAIL, href: `mailto:${LEGAL_EMAIL}` },
        { label: "WhatsApp", value: whatsappDisplay(BRAND.whatsapp), href: brandWhatsappHref(WHATSAPP_HELP_MESSAGE) },
        { label: "Grievance Officer", value: GRIEVANCE_OFFICER },
        { label: "Website", value: BRAND.domain, href: "/" },
      ],
    },
    ctaTitle: "See how Google and AI see your business.",
    cta: { label: "Check my website free", href: "/free-check" },
    contact: { before: `A question, a ${CUSTOM_PLAN.name} plan or help with your report? `, label: "Talk to a real person", href: "/contact", after: "." },
    productOf: (brand, name) => `${brand} is a product of ${name}.`,
    gstLabel: "GST number",
    officeLabel: "Office",
    notRelated: `${BRAND.name} (${BRAND.domain}) is not connected to MyWebRank S.L. in Spain or to getmywebrank.com.`,
  };
}

// TODO(owner): add Shubhankar Gupta's photo, a fuller (true) bio and his LinkedIn/X links in src/lib/authors.ts
// (photo: "/authors/shubhankar-gupta.jpg", sameAs: [...]). The avatar here switches from initials to the photo on its own.
export default function AboutPage() {
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={[
          webPageLd("/about", { type: "AboutPage", name: `About ${BRAND.name}`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } }),
          breadcrumbLd([{ name: "About", path: "/about" }], base),
        ]}
      />
      <AboutBody copy={aboutCopy()} />
    </>
  );
}
