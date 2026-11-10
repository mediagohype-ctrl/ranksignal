// Plain-English messages + classification of DataForSEO errors for the Backlinks API. Pure (duck-typed) so tests and
// the service share it without importing the client.

/** DataForSEO's Backlinks API is a separate monthly subscription on the owner's DataForSEO account. */
export function backlinksFlagOn(): boolean {
  return process.env.DATAFORSEO_BACKLINKS_ENABLED?.trim() === "true";
}

export const BACKLINKS_NOT_ENABLED = "Backlink data isn't switched on for our account yet. Please check back soon.";

export const BACKLINKS_LABEL = "Backlink data from DataForSEO's index — no tool sees every link on the web.";

/**
 * True when DataForSEO refused because the Backlinks API isn't part of the account's subscription (40204 "Access
 * denied … activate your subscription"), or the HTTP layer says unauthorised / payment required.
 */
export function isBacklinksAccessError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { statusCode?: unknown }).statusCode;
  const message = String((e as { message?: unknown }).message ?? "");
  if (typeof code === "number" && [401, 402, 403, 40200, 40204].includes(code)) return true;
  return /access denied|subscription|subscribe|not activated|plans and subscriptions/i.test(message);
}
