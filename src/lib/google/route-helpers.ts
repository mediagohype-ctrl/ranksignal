// Shared bits for the /api/integrations/google/* routes.
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { GOOGLE_PRODUCTS } from "./config";
import { GoogleApiError } from "./http";

export const productSchema = z.enum(GOOGLE_PRODUCTS);
export const projectIdSchema = z.string().min(1).max(64);

/** Turn a Google failure into a friendly, token-free API error. */
export function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof GoogleApiError) {
    if (e.kind === "auth") return new HttpError(409, "google_reconnect", "Google access has expired or was revoked. Please connect again.");
    if (e.kind === "quota") return new HttpError(429, "google_quota", "Google's API limit was reached. Please try again in a few minutes.");
    if (e.kind === "permission") return new HttpError(403, "google_permission", "This Google account doesn't have access to that data.");
    return new HttpError(502, "google_error", `Google returned an error: ${e.message}`.slice(0, 300));
  }
  if (e instanceof Error && /no stored credential/.test(e.message)) return new HttpError(409, "google_reconnect", "Please connect your Google account again.");
  return new HttpError(502, "google_error", "Couldn't reach Google. Please try again.");
}
