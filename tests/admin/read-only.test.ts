// "View as customer" sessions are read-only: middleware rejects every write API outside /api/admin, and
// requireSession refuses anything above viewer.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

const access = vi.hoisted(() => ({ resolveAccess: vi.fn() }));
vi.mock("@/lib/auth/access", () => access);
const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/db", () => ({ db: {} }));

import { middleware } from "@/middleware";
import { requireSession } from "@/lib/api";

const SECRET = "x".repeat(40);
beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

async function token(extra: Record<string, unknown> = {}) {
  return new SignJWT({ org: "o1", role: "viewer", pwf: "p", stf: true, ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("staff1")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

function req(path: string, method: string, jwt: string) {
  return new NextRequest(`http://app.test${path}`, {
    method,
    headers: { host: "app.test", origin: "http://app.test", cookie: `av_session=${jwt}` },
  });
}

describe("middleware read-only guard", () => {
  it("rejects writes from a read-only session", async () => {
    const jwt = await token({ ro: true });
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const res = await middleware(req("/api/projects/p1", method, jwt));
      expect(res.status, method).toBe(403);
      expect((await res.json()).error.code).toBe("read_only");
    }
  });
  it("allows reads, admin routes (exit) and auth routes (log out)", async () => {
    const jwt = await token({ ro: true });
    expect((await middleware(req("/api/projects/p1", "GET", jwt))).status).toBe(200);
    expect((await middleware(req("/api/admin/exit-support", "POST", jwt))).status).toBe(200);
    expect((await middleware(req("/api/auth/logout", "POST", jwt))).status).toBe(200);
  });
  it("does not affect normal sessions", async () => {
    const jwt = await token();
    expect((await middleware(req("/api/projects/p1", "POST", jwt))).status).toBe(200);
  });
});

describe("requireSession with a read-only session", () => {
  it("allows viewer-level reads but refuses anything higher", async () => {
    const s = { userId: "staff1", email: "s@x.test", organizationId: "o1", role: "viewer", staffMode: true, readOnly: true };
    session.getSession.mockResolvedValue(s);
    access.resolveAccess.mockResolvedValue(s);
    await expect(requireSession()).resolves.toMatchObject({ readOnly: true });
    await expect(requireSession("member")).rejects.toMatchObject({ status: 403, code: "read_only" });
  });
});
