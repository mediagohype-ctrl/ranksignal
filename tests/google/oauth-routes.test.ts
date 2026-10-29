// OAuth routes end to end with mocked DB, session and fetch: start redirect, callback storing ONLY the refresh
// token (encrypted), state/nonce/session binding, scope checks, disconnect revocation, and 501 when unconfigured.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeState } from "./fake-db";

const h = vi.hoisted(() => ({
  state: null as unknown as FakeState,
  session: null as null | { userId: string; email: string; organizationId: string; role: string; staffMode?: boolean },
  logs: [] as unknown[],
}));

vi.mock("@/lib/db", async () => {
  const f = await import("./fake-db");
  h.state = f.newState();
  return { db: f.makeDb(h.state) };
});
vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/log", () => ({
  log: { info: (...a: unknown[]) => h.logs.push(a), warn: (...a: unknown[]) => h.logs.push(a), error: (...a: unknown[]) => h.logs.push(a) },
}));

import { decryptSecret } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/google/state";
import { GET as start } from "@/app/api/integrations/google/start/route";
import { GET as callback } from "@/app/api/integrations/google/callback/route";
import { GET as status } from "@/app/api/integrations/google/status/route";
import { POST as disconnect } from "@/app/api/integrations/google/disconnect/route";
import { POST as select } from "@/app/api/integrations/google/select/route";
import { GET as metrics } from "@/app/api/projects/[id]/search-metrics/route";

const ACCESS = "ya29.ACCESS-TOKEN-SHOULD-NEVER-BE-STORED";
const REFRESH = "1//REFRESH-TOKEN-123";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ID_TOKEN = `${b64({ alg: "RS256" })}.${b64({ email: "owner@acme.test", sub: "g1" })}.sig`;

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let tokenResponse: Record<string, unknown>;

function mockFetch() {
  calls = [];
  vi.stubGlobal("fetch", async (input: URL | string, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(String(init.body));
      if (body.get("grant_type") === "refresh_token") return ok({ access_token: "fresh-access" });
      return ok(tokenResponse);
    }
    if (url === "https://oauth2.googleapis.com/revoke") return ok({});
    if (url.startsWith("https://www.googleapis.com/webmasters/v3/sites") && !url.includes("searchAnalytics")) {
      return ok({ siteEntry: [{ siteUrl: "sc-domain:acme.test", permissionLevel: "siteOwner" }] });
    }
    if (url.includes("searchAnalytics")) return ok({ rows: [] });
    return new Response("{}", { status: 404 });
  });
}

function setEnv(configured = true) {
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("CREDENTIALS_KEY", "a".repeat(64));
  vi.stubEnv("APP_URL", "https://app.test");
  vi.stubEnv("GOOGLE_CLIENT_ID", configured ? "client-id.apps.googleusercontent.com" : "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", configured ? "client-secret" : "");
}

beforeEach(async () => {
  const f = await import("./fake-db");
  Object.assign(h.state, f.newState());
  h.state.projects.push({ id: "p1", organizationId: "o1", websiteUrl: "https://www.acme.test/", name: "Acme" });
  h.session = { userId: "u1", email: "owner@acme.test", organizationId: "o1", role: "admin" };
  h.logs = [];
  tokenResponse = {
    access_token: ACCESS,
    refresh_token: REFRESH,
    id_token: ID_TOKEN,
    scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/webmasters.readonly",
  };
  setEnv(true);
  mockFetch();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function callbackReq(o: { nonce?: string; code?: string; product?: "gsc" | "ga4"; userId?: string } = {}) {
  const { token, nonce } = await signOAuthState({ projectId: "p1", orgId: "o1", userId: o.userId ?? "u1", product: o.product ?? "gsc" });
  const u = new URL("https://app.test/api/integrations/google/callback");
  u.searchParams.set("state", token);
  u.searchParams.set("code", o.code ?? "auth-code");
  return callback(new Request(u, { headers: { cookie: `other=1; g_oauth_nonce=${o.nonce ?? nonce}` } }));
}

describe("GET /api/integrations/google/start", () => {
  it("redirects to Google with offline access, consent prompt, a verifiable state and a matching nonce cookie", async () => {
    const res = await start(new Request("https://app.test/api/integrations/google/start?projectId=p1&product=gsc"));
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("access_type")).toBe("offline");
    expect(loc.searchParams.get("prompt")).toBe("consent");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://app.test/api/integrations/google/callback");
    expect(loc.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(loc.searchParams.get("scope")).toContain("openid");
    const st = await verifyOAuthState(loc.searchParams.get("state"));
    expect(st).toMatchObject({ projectId: "p1", orgId: "o1", userId: "u1", product: "gsc" });
    expect(res.headers.get("set-cookie")).toContain(`g_oauth_nonce=${st!.nonce}`);
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });

  it("requires admin and a project in the session's org", async () => {
    h.session = { ...h.session!, role: "member" };
    expect((await start(new Request("https://app.test/api/integrations/google/start?projectId=p1&product=gsc"))).status).toBe(403);
    h.session = { ...h.session!, role: "admin" };
    expect((await start(new Request("https://app.test/api/integrations/google/start?projectId=other&product=gsc"))).status).toBe(404);
    expect((await start(new Request("https://app.test/api/integrations/google/start?projectId=p1&product=ads"))).status).toBe(400);
  });
});

describe("GET /api/integrations/google/callback", () => {
  it("exchanges the code and stores only the encrypted refresh token", async () => {
    const res = await callbackReq();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://app.test/app/projects/p1/integrations?google=gsc");

    const tokenCall = calls.find((c) => c.url === "https://oauth2.googleapis.com/token")!;
    const body = new URLSearchParams(String(tokenCall.init.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe("https://app.test/api/integrations/google/callback");

    expect(h.state.integrations).toHaveLength(1);
    const row = h.state.integrations[0]!;
    expect(row.provider).toBe("gsc");
    expect(row.organizationId).toBe("o1");
    expect(row.projectId).toBe("p1");
    expect(row.health).toBe("healthy");
    expect(JSON.parse(decryptSecret(row.credentialEncrypted as string))).toEqual({ refresh_token: REFRESH });
    expect((row.config as { googleEmail: string }).googleEmail).toBe("owner@acme.test");

    // The access token (and the refresh token in plaintext) appear nowhere in stored rows, audit entries or logs.
    const everything = JSON.stringify({ s: h.state, logs: h.logs });
    expect(everything).not.toContain(ACCESS);
    expect(everything).not.toContain(REFRESH);
    expect(h.state.audit.map((a) => a.action)).toContain("integration.connected");
  });

  it("rejects a nonce that doesn't match the browser cookie", async () => {
    const res = await callbackReq({ nonce: "someone-elses" });
    expect(res.headers.get("location")).toContain("google_error=invalid_state");
    expect(h.state.integrations).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("rejects a state issued to a different user", async () => {
    const res = await callbackReq({ userId: "u2" });
    expect(res.headers.get("location")).toContain("google_error=invalid_state");
    expect(h.state.integrations).toHaveLength(0);
  });

  it("rejects a forged state", async () => {
    const res = await callback(new Request("https://app.test/api/integrations/google/callback?code=x&state=forged"));
    expect(res.headers.get("location")).toBe("https://app.test/app?google_error=invalid_state");
  });

  it("revokes and refuses when the data scope was not granted", async () => {
    tokenResponse.scope = "openid https://www.googleapis.com/auth/userinfo.email";
    const res = await callbackReq();
    expect(res.headers.get("location")).toContain("google_error=scope_missing");
    expect(calls.some((c) => c.url === "https://oauth2.googleapis.com/revoke")).toBe(true);
    expect(h.state.integrations).toHaveLength(0);
  });

  it("refuses when Google returns no refresh token", async () => {
    delete tokenResponse.refresh_token;
    const res = await callbackReq();
    expect(res.headers.get("location")).toContain("google_error=no_refresh_token");
    expect(h.state.integrations).toHaveLength(0);
  });
});

describe("select + disconnect", () => {
  it("saves a property the account can access and rejects one it can't", async () => {
    await callbackReq();
    const post = (body: unknown) =>
      select(new Request("https://app.test/api/integrations/google/select", { method: "POST", body: JSON.stringify(body) }));
    const bad = await post({ projectId: "p1", product: "gsc", siteUrl: "sc-domain:evil.test" });
    expect(bad.status).toBe(400);
    const ok = await post({ projectId: "p1", product: "gsc", siteUrl: "sc-domain:acme.test" });
    expect(ok.status).toBe(200);
    const j = (await ok.json()) as { item: { siteUrl: string; needsSelection: boolean } };
    expect(j.item.siteUrl).toBe("sc-domain:acme.test");
    expect(j.item.needsSelection).toBe(false);
    expect(JSON.stringify(j)).not.toContain("credential");
  });

  it("revokes the refresh token at Google and wipes the credential", async () => {
    await callbackReq();
    calls = [];
    const res = await disconnect(
      new Request("https://app.test/api/integrations/google/disconnect", { method: "POST", body: JSON.stringify({ projectId: "p1", product: "gsc" }) }),
    );
    expect(res.status).toBe(200);
    const revoke = calls.find((c) => c.url === "https://oauth2.googleapis.com/revoke")!;
    expect(new URLSearchParams(String(revoke.init.body)).get("token")).toBe(REFRESH);
    expect(h.state.integrations).toHaveLength(0);
    expect(h.state.audit.at(-1)!.action).toBe("integration.disconnected");
  });

  it("sends bearer tokens only to Google hosts", async () => {
    await callbackReq();
    await select(new Request("https://app.test/x", { method: "POST", body: JSON.stringify({ projectId: "p1", product: "gsc", siteUrl: "sc-domain:acme.test" }) }));
    for (const c of calls) expect(new URL(c.url).hostname.endsWith("googleapis.com")).toBe(true);
  });
});

describe("not configured", () => {
  it("returns 501 with a friendly message when GOOGLE_CLIENT_ID is unset", async () => {
    setEnv(false);
    const res = await start(new Request("https://app.test/api/integrations/google/start?projectId=p1&product=gsc"));
    expect(res.status).toBe(501);
    const j = (await res.json()) as { error: { code: string; message: string } };
    expect(j.error.code).toBe("google_not_configured");
    expect(j.error.message).toMatch(/GOOGLE_CLIENT_ID/);
    expect((await callbackReq()).status).toBe(501);
    const s = (await (await status(new Request("https://app.test/api/integrations/google/status?projectId=p1"))).json()) as {
      configured: boolean;
      redirectUri: string;
    };
    expect(s.configured).toBe(false);
    expect(s.redirectUri).toBe("https://app.test/api/integrations/google/callback");
    expect(calls).toHaveLength(0);
  });
});

describe("GET /api/projects/[id]/search-metrics", () => {
  it("validates the range and scopes to the session's project", async () => {
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    expect((await metrics(new Request("https://app.test/x?from=2026-10-10&to=2026-10-01"), ctx("p1"))).status).toBe(400);
    expect((await metrics(new Request("https://app.test/x?from=bad"), ctx("p1"))).status).toBe(400);
    expect((await metrics(new Request("https://app.test/x"), ctx("nope"))).status).toBe(404);
    const ok = await metrics(new Request("https://app.test/x?from=2026-10-01&to=2026-10-28"), ctx("p1"));
    expect(ok.status).toBe(200);
    const j = (await ok.json()) as { item: { gsc: unknown; ga4: unknown; range: { previousFrom: string } } };
    expect(j.item.gsc).toBeNull();
    expect(j.item.range.previousFrom).toBe("2026-09-03");
  });
});
