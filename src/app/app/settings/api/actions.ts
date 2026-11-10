"use server";
// Server actions for Settings → API: owners/admins create and revoke organization API keys.
// Next.js checks the Origin of server-action POSTs, so these need no extra CSRF handling.
import { headers } from "next/headers";
import { HttpError, requireSession } from "@/lib/api";
import { auditActorFromSession } from "@/lib/audit-log";
import { clientIpFromHeaders } from "@/lib/auth/rate-limit";
import { createApiKey, revokeApiKey, type ApiKeyView } from "@/lib/api-keys/service";
import { log } from "@/lib/log";

export type ApiKeyActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

async function actorFor(session: { userId: string; staffMode?: boolean }) {
  const h = await headers();
  return { ...auditActorFromSession(session), ip: clientIpFromHeaders(h), requestId: h.get("x-request-id") ?? undefined };
}

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof HttpError) return { ok: false, error: err.message };
  log.error("api_keys.action_failed", { err: err instanceof Error ? err : { message: String(err) } });
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createApiKeyAction(name: string): Promise<ApiKeyActionResult<{ key: string; item: ApiKeyView }>> {
  try {
    const s = await requireSession("admin");
    const r = await createApiKey(s.organizationId, name, await actorFor(s));
    return { ok: true, key: r.key, item: r.item };
  } catch (err) {
    return failure(err);
  }
}

export async function revokeApiKeyAction(id: string): Promise<ApiKeyActionResult<{ item: ApiKeyView }>> {
  try {
    const s = await requireSession("admin");
    if (typeof id !== "string" || !id || id.length > 64) return { ok: false, error: "API key not found" };
    const item = await revokeApiKey(s.organizationId, id, await actorFor(s));
    return { ok: true, item };
  } catch (err) {
    return failure(err);
  }
}
