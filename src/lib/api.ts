// Route-handler helpers: consistent error envelope, session + tenant guard, zod parsing.
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getSession } from "@/lib/auth/session";
import { resolveAccess } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import type { Role, SessionContext } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

/** Correlation id: the caller's/proxy's x-request-id when it looks sane (no log injection), else a fresh UUID. */
export function requestIdOf(req?: unknown): string {
  const headers = req && typeof req === "object" && "headers" in req ? (req as { headers?: unknown }).headers : undefined;
  const incoming = headers instanceof Headers ? headers.get("x-request-id") : null;
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
}

export function errorResponse(err: unknown, req?: unknown) {
  const requestId = requestIdOf(req);
  const headers = { "x-request-id": requestId };
  if (err instanceof HttpError) {
    if (err.status >= 500) log.error("api.http_error", { requestId, code: err.code, err });
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details, requestId } }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "validation_error", message: "Invalid input", details: err.flatten(), requestId } }, { status: 400, headers });
  }
  // Unhandled: log class/message/stack (log.ts serializes Errors) with the id the client sees, so a support
  // ticket quoting requestId leads straight to the stack trace. The client never sees internals.
  log.error("api.unhandled", { requestId, err: err instanceof Error ? err : { class: typeof err, message: String(err) } });
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong", requestId } }, { status: 500, headers });
}

/** Wrap a route handler so thrown HttpError/ZodError become JSON error envelopes. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err, args[0]);
    }
  };
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export async function requireSession(minRole: Role = "viewer"): Promise<SessionContext> {
  const token = await getSession();
  if (!token) throw new HttpError(401, "unauthorized", "Sign in required");
  // Re-read access so removals and role changes take effect immediately, not at JWT expiry.
  const session = await resolveAccess(token);
  if (!session) throw new HttpError(401, "unauthorized", "Membership is no longer active");
  if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) throw new HttpError(403, "forbidden", "Insufficient role");
  return session;
}

/** Load a project only if it belongs to the session's organization (tenant isolation). */
export async function requireProject(session: SessionContext, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  return project;
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be JSON");
  }
  return schema.parse(body);
}
