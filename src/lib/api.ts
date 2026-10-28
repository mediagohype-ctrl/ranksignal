// Route-handler helpers: consistent error envelope, session + tenant guard, zod parsing.
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { Role, SessionContext } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "validation_error", message: "Invalid input", details: err.flatten() } }, { status: 400 });
  }
  console.error("[api] unhandled", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
}

/** Wrap a route handler so thrown HttpError/ZodError become JSON error envelopes. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export async function requireSession(minRole: Role = "viewer"): Promise<SessionContext> {
  const token = await getSession();
  if (!token) throw new HttpError(401, "unauthorized", "Sign in required");
  // Re-read membership so removals and role changes take effect immediately, not at JWT expiry.
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: token.userId, organizationId: token.organizationId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "active") throw new HttpError(401, "unauthorized", "Membership is no longer active");
  const session: SessionContext = { ...token, role: membership.role as Role };
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
