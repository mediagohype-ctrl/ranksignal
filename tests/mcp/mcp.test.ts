// Hand-written MCP server: JSON-RPC methods, tool dispatch (org-scoped), errors, and the HTTP route's auth.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  apiKey: { findUnique: vi.fn(), update: vi.fn() },
  project: { findMany: vi.fn(), findFirst: vi.fn() },
  reportSnapshot: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { HttpError } from "@/lib/api";
import { generateApiKey } from "@/lib/api-keys/keys";
import { handleMcpMessage, LATEST_PROTOCOL_VERSION, MCP_TOOLS, RPC, type McpServices } from "@/lib/public-api/mcp";
import { TOOL_NAMES } from "@/lib/public-api/mcp-tools";
import { DELETE, GET, POST } from "@/app/api/mcp/route";

function fakeServices(): McpServices & Record<string, ReturnType<typeof vi.fn>> {
  return {
    listProjects: vi.fn(async () => ({ items: [{ id: "p1" }], nextCursor: null })),
    getReport: vi.fn(async (_org: string, id: string) => {
      if (id !== "p1") throw new HttpError(404, "not_found", "Project not found");
      return { projectId: "p1" };
    }),
    listIssues: vi.fn(async () => ({ items: [], total: 0, generatedAt: "x", nextCursor: null })),
    getVisibility: vi.fn(async () => ({ measured: false })),
    listScores: vi.fn(async () => ({ items: [], nextCursor: null })),
  } as never;
}

const call = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) });

describe("JSON-RPC methods", () => {
  it("initialize negotiates the protocol version and advertises tools", async () => {
    const r = (await handleMcpMessage(call(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } }), "orgA")) as { result: Record<string, unknown> };
    expect(r.result.protocolVersion).toBe("2025-03-26");
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
    const unknown = (await handleMcpMessage(call(2, "initialize", { protocolVersion: "1999-01-01" }), "orgA")) as { result: Record<string, unknown> };
    expect(unknown.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("ping, tools/list, unknown methods and notifications", async () => {
    expect(await handleMcpMessage(call(3, "ping"), "orgA")).toEqual({ jsonrpc: "2.0", id: 3, result: {} });
    const list = (await handleMcpMessage(call(4, "tools/list"), "orgA")) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
    expect(list.result.tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    expect(list.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
    expect(await handleMcpMessage(call(5, "resources/list"), "orgA")).toMatchObject({ error: { code: RPC.METHOD_NOT_FOUND } });
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, "orgA")).toBeNull();
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 9, result: {} }, "orgA")).toBeNull();
    expect(await handleMcpMessage({ id: 6, method: "ping" }, "orgA")).toMatchObject({ error: { code: RPC.INVALID_REQUEST } });
    expect(await handleMcpMessage("nope", "orgA")).toMatchObject({ id: null, error: { code: RPC.INVALID_REQUEST } });
  });

  it("every tool has an object input schema", () => {
    for (const t of MCP_TOOLS) expect(t.inputSchema.type).toBe("object");
  });
});

describe("tools/call", () => {
  let svc: ReturnType<typeof fakeServices>;
  beforeEach(() => {
    svc = fakeServices();
  });

  it("calls the shared service with the key's organization and returns text + structured content", async () => {
    const r = (await handleMcpMessage(call(1, "tools/call", { name: "list_projects", arguments: { limit: 5 } }), "orgA", svc)) as { result: { content: { type: string; text: string }[]; structuredContent: unknown; isError?: boolean } };
    expect(svc.listProjects).toHaveBeenCalledWith("orgA", { cursor: null, limit: 5 });
    expect(r.result.isError).toBeUndefined();
    expect(JSON.parse(r.result.content[0].text)).toEqual(r.result.structuredContent);
  });

  it("passes project ids through to org-scoped services; not-found is a tool error, not a protocol error", async () => {
    const r = (await handleMcpMessage(call(2, "tools/call", { name: "get_report", arguments: { project_id: "other" } }), "orgA", svc)) as { result: { isError: boolean; content: { text: string }[] } };
    expect(svc.getReport).toHaveBeenCalledWith("orgA", "other");
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toBe("Project not found");
  });

  it("validates arguments", async () => {
    const missing = (await handleMcpMessage(call(3, "tools/call", { name: "list_issues", arguments: {} }), "orgA", svc)) as { result: { isError: boolean; content: { text: string }[] } };
    expect(missing.result.isError).toBe(true);
    expect(missing.result.content[0].text).toMatch(/project_id/);
    const extra = (await handleMcpMessage(call(4, "tools/call", { name: "get_scores", arguments: { project_id: "p1", sql: "drop" } }), "orgA", svc)) as { result: { isError: boolean } };
    expect(extra.result.isError).toBe(true);
    expect(await handleMcpMessage(call(5, "tools/call", { name: "delete_everything" }), "orgA", svc)).toMatchObject({ error: { code: RPC.INVALID_PARAMS } });
    expect(svc.listIssues).not.toHaveBeenCalled();
    expect(svc.listScores).not.toHaveBeenCalled();
  });

  it("maps cursors and filters for list_issues and get_scores", async () => {
    await handleMcpMessage(call(6, "tools/call", { name: "list_issues", arguments: { project_id: "p1", impact: "high" } }), "orgA", svc);
    expect(svc.listIssues).toHaveBeenCalledWith("orgA", "p1", { pillar: undefined, impact: "high", offset: 0, limit: 50 });
    await handleMcpMessage(call(7, "tools/call", { name: "get_scores", arguments: { project_id: "p1", kind: "visibility" } }), "orgA", svc);
    expect(svc.listScores).toHaveBeenCalledWith("orgA", "p1", { kind: "visibility", cursor: null, limit: 100 });
  });
});

describe("HTTP route", () => {
  const keyRows = new Map<string, unknown>();
  beforeEach(() => {
    vi.clearAllMocks();
    keyRows.clear();
    mockDb.apiKey.findUnique.mockImplementation(async ({ where }: { where: { keyHash: string } }) => keyRows.get(where.keyHash) ?? null);
    mockDb.apiKey.update.mockResolvedValue({});
    mockDb.project.findMany.mockResolvedValue([]);
    mockDb.reportSnapshot.findMany.mockResolvedValue([]);
  });
  function key(organizationId = "orgA") {
    const g = generateApiKey();
    keyRows.set(g.hash, { id: `k-${g.prefix}`, organizationId, scopes: ["read"], revokedAt: null, lastUsedAt: new Date(), organization: { planId: "growth", status: "active" } });
    return g.key;
  }
  const post = (body: unknown, k?: string, headers: Record<string, string> = {}) =>
    POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-real-ip": "10.1.1.1", ...(k ? { authorization: `Bearer ${k}` } : {}), ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  it("401 without a valid key", async () => {
    const res = await post(call(1, "initialize", {}));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
    expect((await post(call(1, "ping"), generateApiKey().key)).status).toBe(401);
  });

  it("answers requests with JSON and notifications with 202", async () => {
    const k = key();
    const res = await post(call(1, "ping"), k);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, k);
    expect(note.status).toBe(202);
  });

  it("scopes tool calls to the key's organization", async () => {
    const res = await post(call(2, "tools/call", { name: "list_projects", arguments: {} }), key("orgZ"));
    expect(res.status).toBe(200);
    expect(mockDb.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "orgZ" }) }));
  });

  it("handles batches, parse errors and unsupported protocol versions", async () => {
    const k = key();
    const batch = await post([call(1, "ping"), { jsonrpc: "2.0", method: "notifications/initialized" }, call(2, "tools/list")], k);
    const replies = await batch.json();
    expect(replies.map((r: { id: number }) => r.id)).toEqual([1, 2]);
    const bad = await post("{not json", k);
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(RPC.PARSE_ERROR);
    expect((await post(call(3, "ping"), k, { "mcp-protocol-version": "2000-01-01" })).status).toBe(400);
  });

  it("GET and DELETE are 405", () => {
    expect(GET().status).toBe(405);
    expect(DELETE().status).toBe(405);
  });
});
