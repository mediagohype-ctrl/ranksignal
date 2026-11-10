// Minimal Model Context Protocol server (Streamable HTTP transport, JSON responses only), implemented by hand so we
// don't add @modelcontextprotocol/sdk. Spec: https://modelcontextprotocol.io/specification (2025-06-18; also accepts
// 2025-03-26 and 2024-11-05). Supported: initialize, notifications/initialized, ping, tools/list, tools/call.
// Stateless: no Mcp-Session-Id, no server-initiated messages, no SSE stream (GET answers 405, as the spec allows).
// Tools are read-only wrappers over src/lib/public-api/service.ts (the same functions the REST API uses).
import { z, ZodError } from "zod";
import { HttpError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { API_VERSION } from "./openapi";
import { MCP_TOOLS, type ToolName } from "./mcp-tools";
import * as service from "./service";
import { decodeKeysetCursor, decodeOffsetCursor } from "./params";

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

export type JsonRpcId = string | number | null;
export interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const RPC = { PARSE_ERROR: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 } as const;

/** The data functions tools call (injectable for tests). */
export type McpServices = Pick<typeof service, "listProjects" | "getReport" | "listIssues" | "getVisibility" | "listScores">;

const projectIdArg = z.string().min(1).max(64);
const cursorArg = z.string().max(512).optional();
const ARGS = {
  list_projects: z.object({ cursor: cursorArg, limit: z.number().int().min(1).max(100).optional() }).strict(),
  get_report: z.object({ project_id: projectIdArg }).strict(),
  list_issues: z
    .object({
      project_id: projectIdArg,
      pillar: z.enum(["seo", "aeo", "geo", "brand"]).optional(),
      impact: z.enum(["high", "medium", "low"]).optional(),
      cursor: cursorArg,
      limit: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
  get_visibility: z.object({ project_id: projectIdArg }).strict(),
  get_scores: z
    .object({
      project_id: projectIdArg,
      kind: z.enum(["crawl", "visibility"]).optional(),
      cursor: cursorArg,
      limit: z.number().int().min(1).max(500).optional(),
    })
    .strict(),
} satisfies Record<ToolName, z.ZodTypeAny>;
export { MCP_TOOLS, type ToolName };

/** Runs one tool; returns plain JSON data. Throws ZodError for bad arguments and HttpError for not-found etc. */
export async function runTool(name: ToolName, rawArgs: unknown, organizationId: string, svc: McpServices = service): Promise<Record<string, unknown>> {
  switch (name) {
    case "list_projects": {
      const a = ARGS.list_projects.parse(rawArgs ?? {});
      const page = await svc.listProjects(organizationId, { cursor: decodeKeysetCursor(a.cursor ?? null), limit: a.limit ?? 50 });
      return { projects: page.items, nextCursor: page.nextCursor };
    }
    case "get_report": {
      const a = ARGS.get_report.parse(rawArgs ?? {});
      return { report: await svc.getReport(organizationId, a.project_id) };
    }
    case "list_issues": {
      const a = ARGS.list_issues.parse(rawArgs ?? {});
      const page = await svc.listIssues(organizationId, a.project_id, { pillar: a.pillar, impact: a.impact, offset: decodeOffsetCursor(a.cursor ?? null), limit: a.limit ?? 50 });
      return { issues: page.items, total: page.total, generatedAt: page.generatedAt, nextCursor: page.nextCursor };
    }
    case "get_visibility": {
      const a = ARGS.get_visibility.parse(rawArgs ?? {});
      return { visibility: await svc.getVisibility(organizationId, a.project_id) };
    }
    case "get_scores": {
      const a = ARGS.get_scores.parse(rawArgs ?? {});
      const page = await svc.listScores(organizationId, a.project_id, { kind: a.kind, cursor: decodeKeysetCursor(a.cursor ?? null), limit: a.limit ?? 100 });
      return { scores: page.items, nextCursor: page.nextCursor };
    }
  }
}

const isToolName = (v: unknown): v is ToolName => typeof v === "string" && Object.prototype.hasOwnProperty.call(ARGS, v);
const validId = (v: unknown): v is string | number => typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
const rpcError = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
const rpcResult = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Handles one JSON-RPC message for an authenticated organization. Returns the response, or null for
 * notifications and client responses (which get no reply).
 */
export async function handleMcpMessage(msg: unknown, organizationId: string, svc: McpServices = service): Promise<JsonRpcResponse | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return rpcError(null, RPC.INVALID_REQUEST, "Invalid request");
  const m = msg as JsonRpcMessage;
  const hasId = "id" in m && m.id !== undefined;
  // Client responses to server requests (we never send any) and notifications: no reply.
  if (m.method === undefined && ("result" in m || "error" in m)) return null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcError(hasId && validId(m.id) ? m.id : null, RPC.INVALID_REQUEST, "Invalid request");
  if (!hasId) return null; // notification (e.g. notifications/initialized, notifications/cancelled)
  if (!validId(m.id)) return rpcError(null, RPC.INVALID_REQUEST, "Invalid request id");
  const id = m.id;
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mywebrank", title: BRAND.name, version: API_VERSION },
        instructions:
          `Read-only access to this ${BRAND.name} workspace. Start with list_projects to get project ids, then call get_report, ` +
          "list_issues, get_visibility or get_scores. Scores are 0–100; rates are 0–1. Answers marked simulated are demo data, not real AI assistants.",
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS });
    case "tools/call": {
      if (!isToolName(params.name)) return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      try {
        const data = await runTool(params.name, params.arguments, organizationId, svc);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });
      } catch (err) {
        if (err instanceof ZodError) {
          return rpcResult(id, toolError(`Invalid arguments: ${err.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ")}`));
        }
        if (err instanceof HttpError && err.status < 500) return rpcResult(id, toolError(err.message));
        throw err; // unexpected: the route turns it into a JSON-RPC internal error and logs it
      }
    }
    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${m.method}`);
  }
}
