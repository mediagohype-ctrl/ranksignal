// Share links for a free-check result (pure, unit-tested). No score image: results are not stored, so a link
// preview could not show the right score — the score goes in the ready-typed message instead.
import type { FreeCheckLang } from "@/lib/free-check/strings";

/** "https://www.acme.example/" → "acme.example" (the raw input when it is not a URL). */
export function resultHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Link back to the free check with the website filled in, so it starts by itself when opened. */
export function freeCheckLink(base: string, websiteUrl: string, lang: FreeCheckLang = "en"): string {
  const path = lang === "hi" ? "/hi/free-check" : "/free-check";
  return `${base.replace(/\/+$/, "")}${path}?url=${encodeURIComponent(resultHost(websiteUrl))}`;
}

/** WhatsApp share sheet with the message ready (no number: the person picks who to send it to). */
export function whatsappShareHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** LinkedIn "start a post" with the message (which carries the link) ready-typed. */
export function linkedinShareHref(message: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(message)}`;
}

/** Sign-up with the checked website carried into onboarding. */
export function signupHref(url: string): string {
  return `/signup?website=${encodeURIComponent(url)}`;
}

/** Logged-in visitors: the new-website flow with the checked website filled in. */
export function addWebsiteHref(url: string): string {
  return `/app/onboarding?website=${encodeURIComponent(url)}`;
}

/** Log in, then land on the full report flow for the checked website (the login page links on to sign-up with the same next). */
export function loginHref(url: string): string {
  return `/login?next=${encodeURIComponent(addWebsiteHref(url))}`;
}
