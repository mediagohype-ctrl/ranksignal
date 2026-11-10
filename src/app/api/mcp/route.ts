// MCP server (Streamable HTTP, stateless, JSON responses): POST /api/mcp with `Authorization: Bearer mwr_…`.
// Protocol handling lives in src/lib/public-api/mcp.ts; tools are read-only. Each JSON-RPC message counts once against the
// key's rate limits (shared with the REST API).
import { NextResponse } from "next/server";
import { requestIdOf } from "@/lib/api";
import { log } from "@/lib/log";
import { apiErrorResponse, authorizeApiRequest, consumeRateLimit, rateHeaders } from "@/lib/public-api/http";
import { MCP_PROTOCOL_VERSIONS, RPC, handleMcpMessage, type JsonRpcResponse } from "@/lib/public-api/mcp";

export const dynamic = "force-dynamic";

/** Request bodies above this are rejected (tools take a few small arguments). */
const MAX_BODY_BYTES = 256 * 1024;
const MAX_BATCH = 20;

const rpcError = (code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id: null, error: { code, message } });

export async function POST(req: Request): Promise<Response> {
  const requestId = requestIdOf(req);
  let auth: Awaited<ReturnType<typeof authorizeApiRequest>>;
  try {
    auth = await authorizeApiRequest(req);
  } catch (err) {
    return apiErrorResponse(err, requestId);
  }
  const headers: Record<string, string> = { ...rateHeaders(auth.rate), "x-request-id": requestId, "Cache-Control": "no-store" };

  const version = req.headers.get("mcp-protocol-version");
  if (version && !(MCP_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return NextResponse.json(rpcError(RPC.INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${version}`), { status: 400, headers });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json(rpcError(RPC.INVALID_REQUEST, "Request too large"), { status: 413, headers });
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return NextResponse.json(rpcError(RPC.INVALID_REQUEST, "Request too large"), { status: 413, headers });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(rpcError(RPC.PARSE_ERROR, "Parse error"), { status: 400, headers });
  }
  const batch = Array.isArray(body);
  const messages = batch ? (body as unknown[]) : [body];
  if (!messages.length || messages.length > MAX_BATCH) {
    return NextResponse.json(rpcError(RPC.INVALID_REQUEST, `Send 1–${MAX_BATCH} messages`), { status: 400, headers });
  }
  // A batch costs one request per message, so batching can't stretch the rate limits.
  try {
    for (let i = 1; i < messages.length; i++) Object.assign(headers, rateHeaders(consumeRateLimit(auth.principal)));
  } catch (err) {
    return apiErrorResponse(err, requestId);
  }

  const replies: JsonRpcResponse[] = [];
  for (const msg of messages) {
    try {
      const r = await handleMcpMessage(msg, auth.principal.organizationId);
      if (r) replies.push(r);
    } catch (err) {
      log.error("mcp.unhandled", { requestId, err: err instanceof Error ? err : { message: String(err) } });
      const id = msg && typeof msg === "object" && "id" in msg ? ((msg as { id: unknown }).id as string | number) : null;
      replies.push({ jsonrpc: "2.0", id: id ?? null, error: { code: RPC.INTERNAL, message: "Internal error", data: { requestId } } });
    }
  }
  // Only notifications / responses: 202 Accepted with no body (Streamable HTTP transport).
  if (!replies.length) return new Response(null, { status: 202, headers });
  return NextResponse.json(batch ? replies : replies[0], { status: 200, headers });
}

/** No server-to-client SSE stream: the spec lets servers answer GET with 405. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

/** Stateless server: there is no session to delete. */
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
