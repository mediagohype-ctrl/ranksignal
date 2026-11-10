// Completeness checklist for a Google Business Profile, from what the public Places data shows. Pure (tested).
import { PLACES_MAX_PHOTOS, type PlaceSnapshot } from "./places";

export type CheckStatus = "pass" | "fix" | "check";

export interface ChecklistItem {
  id: "status" | "name" | "category" | "hours" | "website" | "phone" | "photos" | "description" | "reviews";
  label: string;
  status: CheckStatus;
  /** What we saw. */
  detail: string;
  /** Plain-English fix (empty when passing). */
  fix: string;
}

const host = (u: string | null | undefined) => {
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

export function completenessChecklist(p: PlaceSnapshot, o: { projectWebsite?: string | null } = {}): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const status = p.businessStatus ?? "OPERATIONAL";
  items.push(
    status === "OPERATIONAL"
      ? { id: "status", label: "Shown as open for business", status: "pass", detail: "Google shows the business as operational.", fix: "" }
      : {
          id: "status",
          label: "Shown as open for business",
          status: "fix",
          detail: status === "CLOSED_PERMANENTLY" ? "Google shows the business as permanently closed." : "Google shows the business as temporarily closed.",
          fix: "If you're open, sign in to your Business Profile and mark the business as open. Customers skip closed listings.",
        },
  );
  items.push(
    p.name
      ? { id: "name", label: "Business name", status: "pass", detail: p.name, fix: "" }
      : { id: "name", label: "Business name", status: "fix", detail: "No name returned.", fix: "Add your real business name in your Business Profile." },
  );
  items.push(
    p.category || p.primaryType
      ? { id: "category", label: "Main category", status: "pass", detail: p.category ?? p.primaryType ?? "", fix: "" }
      : {
          id: "category",
          label: "Main category",
          status: "fix",
          detail: "No main category is shown.",
          fix: "Pick the most specific main category (e.g. \"Dental clinic\", not \"Doctor\"). It's the biggest factor in which searches you appear for.",
        },
  );
  items.push(
    p.hasHours
      ? { id: "hours", label: "Opening hours", status: "pass", detail: "Opening hours are listed.", fix: "" }
      : {
          id: "hours",
          label: "Opening hours",
          status: "fix",
          detail: "No opening hours are listed.",
          fix: "Add your opening hours (and holiday hours). Google shows \"Open now\" to searchers and favours listings that have hours.",
        },
  );
  const siteHost = host(p.website);
  const projectHost = host(o.projectWebsite ?? null);
  if (!p.website) {
    items.push({
      id: "website", label: "Website link", status: "fix", detail: "No website is linked.",
      fix: "Add your website address to your Business Profile so people can go from Maps straight to your site.",
    });
  } else if (projectHost && siteHost && siteHost !== projectHost && !siteHost.endsWith(`.${projectHost}`)) {
    items.push({
      id: "website", label: "Website link", status: "check", detail: `Links to ${siteHost}, not ${projectHost}.`,
      fix: `If ${projectHost} is your main website, change the website link in your Business Profile to it.`,
    });
  } else {
    items.push({ id: "website", label: "Website link", status: "pass", detail: p.website, fix: "" });
  }
  items.push(
    p.phone || p.internationalPhone
      ? { id: "phone", label: "Phone number", status: "pass", detail: p.phone ?? p.internationalPhone ?? "", fix: "" }
      : {
          id: "phone", label: "Phone number", status: "fix", detail: "No phone number is shown.",
          fix: "Add a phone number customers can call. Many people tap \"Call\" straight from Google.",
        },
  );
  items.push(
    p.photosCount >= PLACES_MAX_PHOTOS
      ? { id: "photos", label: "Photos", status: "pass", detail: `${PLACES_MAX_PHOTOS}+ photos.`, fix: "" }
      : p.photosCount > 0
        ? {
            id: "photos", label: "Photos", status: "check", detail: `${p.photosCount} photo${p.photosCount === 1 ? "" : "s"}.`,
            fix: "Add more real photos: outside (so people recognise it), inside, your team, and your products or work. Aim for 10 or more.",
          }
        : {
            id: "photos", label: "Photos", status: "fix", detail: "No photos.",
            fix: "Add a logo, a cover photo and at least 10 real photos of your place, team and work.",
          },
  );
  items.push(
    p.editorialSummary
      ? { id: "description", label: "Description", status: "pass", detail: "Google shows a summary of the business.", fix: "" }
      : {
          id: "description", label: "Description", status: "check",
          detail: "We can't read your own description from Google Maps' public data.",
          fix: "Open your Business Profile and check the \"From the business\" description: 2–3 sentences on what you offer, where, and for whom.",
        },
  );
  const count = p.reviewCount ?? 0;
  items.push(
    count >= 10
      ? { id: "reviews", label: "Reviews", status: "pass", detail: `${count} reviews${p.rating != null ? `, rated ${p.rating.toFixed(1)}` : ""}.`, fix: "" }
      : {
          id: "reviews", label: "Reviews", status: count > 0 ? "check" : "fix",
          detail: count > 0 ? `${count} review${count === 1 ? "" : "s"}.` : "No reviews yet.",
          fix: "Ask happy customers for a review (share your review link on WhatsApp after a sale) and reply to every review.",
        },
  );
  return items;
}

export function checklistScore(items: ChecklistItem[]): { passed: number; total: number } {
  return { passed: items.filter((i) => i.status === "pass").length, total: items.length };
}
